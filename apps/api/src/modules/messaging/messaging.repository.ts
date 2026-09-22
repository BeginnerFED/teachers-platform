import type { Enums, Tables } from '@tp/shared'
import { ForbiddenError } from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type PersonRow = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email' | 'role'>

export type ConversationRow = Pick<
  Tables<'conversations'>,
  'id' | 'last_message_at' | 'last_message_body' | 'last_message_sender_id'
> & {
  /** Both sides, including the caller; the mapper is what picks out the other one. */
  conversation_participants: {
    profile_id: string
    last_read_at: string | null
    unread_count: number
    profile: PersonRow | null
  }[]
}

export type MessageRow = Pick<Tables<'messages'>, 'id' | 'body' | 'created_at' | 'sender_id'>

export type MessagingRepository = {
  listConversations(profileId: string): Promise<ConversationRow[]>
  findConversation(conversationId: string): Promise<ConversationRow | null>
  findByPairKey(pairKey: string): Promise<ConversationRow | null>
  createConversation(pairKey: string, participants: [string, string]): Promise<string>
  /** One small read, because the shell asks for this on every page in the product. */
  sumUnread(profileId: string): Promise<number>
  listMessages(conversationId: string, limit: number): Promise<MessageRow[]>
  sendIfAllowed(input: {
    conversationId: string
    senderId: string
    body: string
  }): Promise<MessageRow>
  markRead(conversationId: string, profileId: string, at: string): Promise<void>
  findPerson(profileId: string): Promise<PersonRow | null>
  listByRole(role: Enums<'user_role'>): Promise<PersonRow[]>
  /** The other end of every current pairing this person is part of. */
  listLinkedTo(profileId: string, role: 'teacher' | 'student'): Promise<PersonRow[]>
  /** Authorization check: only an active teacher-student row counts as linked. */
  areLinked(teacherId: string, studentId: string): Promise<boolean>
}

const PERSON = 'id,full_name,email,role'
const CONVERSATION = 'id,last_message_at,last_message_body,last_message_sender_id'
const PARTICIPANTS =
  'conversation_participants(profile_id,last_read_at,unread_count,profile:profiles!conversation_participants_profile_id_fkey(id,full_name,email,role))'

export const messagingRepository: MessagingRepository = {
  async listConversations(profileId) {
    // Reached through the caller's own membership row, then widened back out to both
    // sides. Asking conversations directly would need a filter on an embedded column,
    // which narrows the embed rather than the list.
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('profile_id', profileId)

    if (membershipError) throwFromPostgrest(membershipError, 'list conversations')

    const ids = (memberships ?? []).map((row) => row.conversation_id)
    if (ids.length === 0) return []

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select(`${CONVERSATION},${PARTICIPANTS}`)
      .in('id', ids)
      // A conversation nobody has spoken in is not an item in an inbox. Opening one with
      // somebody and walking away should leave no trace; picking them again finds the
      // same empty thread rather than making a second.
      .not('last_message_at', 'is', null)
      .order('last_message_at', { ascending: false })
      .returns<ConversationRow[]>()

    if (error) throwFromPostgrest(error, 'list conversations')

    return data ?? []
  },

  async findConversation(conversationId) {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select(`${CONVERSATION},${PARTICIPANTS}`)
      .eq('id', conversationId)
      .maybeSingle()
      .returns<ConversationRow | null>()

    if (error) throwFromPostgrest(error, 'find conversation')

    return data
  },

  async findByPairKey(pairKey) {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select(`${CONVERSATION},${PARTICIPANTS}`)
      .eq('pair_key', pairKey)
      .maybeSingle()
      .returns<ConversationRow | null>()

    if (error) throwFromPostgrest(error, 'find conversation by pair')

    return data
  },

  async createConversation(pairKey, participants) {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({ pair_key: pairKey })
      .select('id')
      .single()

    if (error) throwFromPostgrest(error, 'create conversation')

    const { error: participantError } = await supabaseAdmin
      .from('conversation_participants')
      .insert(
        participants.map((profileId) => ({ conversation_id: data.id, profile_id: profileId })),
      )

    if (participantError) throwFromPostgrest(participantError, 'add participants')

    return data.id
  },

  async sumUnread(profileId) {
    // The counter lives on the membership row, so this never touches conversations or
    // messages at all.
    const { data, error } = await supabaseAdmin
      .from('conversation_participants')
      .select('unread_count')
      .eq('profile_id', profileId)
      .gt('unread_count', 0)

    if (error) throwFromPostgrest(error, 'count unread')

    return (data ?? []).reduce((total, row) => total + row.unread_count, 0)
  },

  async listMessages(conversationId, limit) {
    // Newest first so the limit takes the most recent; the mapper turns it back round.
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id,body,created_at,sender_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throwFromPostgrest(error, 'list messages')

    return data ?? []
  },

  async sendIfAllowed({ conversationId, senderId, body }) {
    const { data, error } = await supabaseAdmin.rpc('send_message_if_allowed', {
      p_conversation: conversationId,
      p_sender: senderId,
      p_body: body,
    })

    if (error?.code === '42501') throw new ForbiddenError('You cannot message that person')
    if (error) throwFromPostgrest(error, 'send message')
    const row = data?.[0]
    if (!row) throw new Error('The sent message came back empty')
    return row
  },

  async markRead(conversationId, profileId, at) {
    const { error } = await supabaseAdmin
      .from('conversation_participants')
      .update({ last_read_at: at, unread_count: 0 })
      .eq('conversation_id', conversationId)
      .eq('profile_id', profileId)

    if (error) throwFromPostgrest(error, 'mark read')
  },

  async findPerson(profileId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(PERSON)
      .eq('id', profileId)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'find person')

    return data
  },

  async listByRole(role) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(PERSON)
      .eq('role', role)
      .order('full_name', { ascending: true, nullsFirst: false })

    if (error) throwFromPostgrest(error, 'list people')

    return data ?? []
  },

  async listLinkedTo(profileId, role) {
    // Whichever end of the pairing the caller is, the other end is who they may write to.
    const column = role === 'teacher' ? 'teacher_id' : 'student_id'
    const other = role === 'teacher' ? 'student_id' : 'teacher_id'

    const { data, error } = await supabaseAdmin
      .from('teacher_students')
      .select(`other:profiles!teacher_students_${other}_fkey(${PERSON})`)
      .eq(column, profileId)
      .eq('status', 'active')
      .returns<{ other: PersonRow | null }[]>()

    if (error) throwFromPostgrest(error, 'list correspondents')

    return (data ?? [])
      .map((row) => row.other)
      .filter((person): person is PersonRow => person !== null)
  },

  async areLinked(teacherId, studentId) {
    const { data, error } = await supabaseAdmin
      .from('teacher_students')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'check pairing')

    return data !== null
  },
}
