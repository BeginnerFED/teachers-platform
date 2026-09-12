# Yayına hazırlık — 13 Eylül 2026

## Bu turda tamamlananlar

- Dersin başlamasına en fazla 15 dakika kaldığında öğretmene ve kayıtlı katılımcılarına platform içi hatırlatma hazırlanır. Ödevin teslim süresinin son 24 saatinde yalnızca teslim etmemiş öğrenci hatırlatma alır. Daha geç planlanan ders veya ödev, sonraki görev çalışmasında yakalanır.
- `platform-study-reminders` adlı Supabase Cron görevi her dakika çalışır. Tarayıcının açık olması gerekmez. Bildirimlerin görülmesi için platforma giriş gerekir; e-posta veya cihaz bildirimi gönderilmez.
- Aynı kişi, ders/ödev ve tarih için tekrar kayıt oluşturulmaz. Okundu bilgisi korunur. Dersin zamanı değişirse, iptal edilirse, katılımcı çıkarılırsa veya ödev teslim edilirse eski hatırlatma kaldırılır. Başlamış dersin hatırlatması ders bitimine kadar görünür.
- Öğrenci mevcut bildirim menüsünü kullanır. Öğretmen ve adminin üst çubuğundaki zil kendi ders hatırlatmalarını gösterir. Her bildirim ilgili takvim haftasına ve derse ya da ödeve gider.
- Ödevin son teslim saati, takvimle aynı saat diliminde, seçilen günün **Kyiv saatiyle 23.59** değeridir. Öğretmenin bilgisayarının saat diliminden etkilenmez.
- API sağlık kontrolü artık veritabanı erişiminin yanında zamanlanmış görevin açık olduğunu ve son beş dakikada başarıyla çalıştığını doğrular. Next.js sunucu hataları, sayfa şablonu ve hata digest'i ile JSON olarak kaydedilir; bu kayıt sorgu parametrelerini, çerezleri ve öğrenci cevaplarını içermez.
- Dahili `rls_auto_enable` şema tetikleyicisinin gereksiz `anon` / `authenticated` çalıştırma izinleri kaldırıldı. Otomatik RLS davranışı korunuyor.

## Doğrulananlar

Production web ve API derlemesi, API TypeScript kontrolü ve kaynak lint kontrolleri geçti. Derlemede önceden var olan sekiz `::highlight(live-*)` CSS uyarısı sürüyor.

Geçici gerçek Supabase hesaplarıyla API ve doğrudan RLS erişimi kontrol edildi: kullanıcıların birbirinin hatırlatmalarını okuyamaması veya okundu işaretleyememesi, zamanlanmış fonksiyonun istemciden çalıştırılamaması, yinelenen gönderim, eski okundu isteği, iptal/erteleme/katılımcı çıkarma, ödev teslimi, sabit ödev başlığı ve aboneliği askıya alınmış öğretmenin bildirim erişimi geçti. Geçici hesaplar ve içerikler temizlendi.

Görev hatası simülasyonunda readiness 503, liveness 200 verdi; normal çalışmaya dönünce readiness tekrar 200 oldu. Yaz/kış Kyiv son teslim saatleri üç farklı bilgisayar saat diliminde aynı sonucu verdi. Production tarayıcı paketlerinde sunucu anahtarları bulunmadı.

Production uygulama izole Edge oturumlarında admin, öğretmen ve öğrenci olarak açıldı. Ana sayfa, takvim, ayarlar ve ödevler; bildirim bağlantıları; 375 px mobil genişlik ve açılır menü sınırları kontrol edildi. Masaüstü bildirim bağlantıları da doğrulandı.

## Hesap menüsü ve seri iptali — 13 Eylül 2026

- Hesap menüsündeki “Hesap” bağlantısı admin, öğretmen ve öğrenciyi kendi ayarlarındaki profil bölümüne götürür. Temadan kalan pasif Pro, ödeme ve bildirim seçenekleri kaldırıldı.
- Öğretmen takvimindeki ders ayrıntısından **Dersi iptal et → Bu ve serinin sonraki dersleri** seçilebilir. Onay ekranında etkilenecek planlı ders sayısı ve tarih aralığı gösterilir.
- Toplu işlem yalnızca seçilen, henüz başlamamış ders ve serinin sonraki planlı derslerini iptal eder. Önceki, yapılmış ve zaten iptal edilmiş dersler korunur; yoklama ve ders hakkı geçmişi değişmez. Öğrencilere mevcut bildirim yapısıyla iptal haberi gider, eski hatırlatmalar kaldırılır.
- Açık canlı ders varsa işlem tamamen reddedilir. Önizlemeden sonra seri değişmişse yeniden kontrol istenir. Yanıt kaybolduğunda aynı istek yeniden gönderilebilir; sonradan geri açılmış dersler eski isteğin tekrarıyla yeniden iptal edilmez.
- API ve Supabase kontrollerinde ders sayısı, sahiplik/RLS, açık canlı derste işlemin tümüyle reddedilmesi, eski sürüm hatası, yoklama/ders hakkı korunması, öğrenci bildirimleri ve geri açma sonrası tekrar deneme doğrulandı.
- Production derlemesi ve lint geçti. Gerçek Edge oturumlarında üç rolün hesap menüsünden doğru profil ayarına ulaşması doğrulandı. Öğretmen takviminde masaüstü ve 375 px mobil önizleme, pencere sınırları ve onayla üç dersin gerçekten iptal edilmesi kontrol edildi. Geçici hesap ve dersler temizlendi.
- MCP migrasyonları: `add_atomic_following_lesson_cancellation`, `return_attendance_version_conflicts_without_transaction_retries`.

## Bildirim tercihleri — 13 Eylül 2026

- Admin, öğretmen ve öğrencinin mevcut **Ayarlar → Bildirim tercihleri** bölümüne shadcn anahtarları eklendi. Ders hatırlatmaları her rol için, ödev teslim hatırlatmaları öğrenciler için ayrı ayrı yönetilir. Yeni hesaplarda hatırlatmalar açıktır.
- Tercihler hesabın Supabase kaydında saklanır. API kullanıcı kimliğini oturumdan alır; kısmi güncellemeler atomik olarak birleştirilir. Kullanıcı başka hesabın tercihlerini okuyamaz veya değiştiremez. Öğretmenin aboneliği bitse de kendi tercihlerini yönetebilir.
- Zamanlanmış görev kapatılan tür için yeni hatırlatma üretmez. Önceden üretilmiş hatırlatmalar API ve istemci RLS sorgularında gizlenir; tekrar açıldığında süresi dolmamış kayıtlar görünür. Aynı hatırlatma çoğaltılmaz ve okundu bilgisi korunur.
- Ders planlama/değişiklik/iptal, ödev atama/değerlendirme ve canlı ders davetleri bu tercihlerden etkilenmez. Kaydetme sonrası bildirim listesi güncellenir; diğer açık oturumlar Realtime ve mevcut periyodik kontrolle değişikliği alır.
- MCP migrasyonu: `add_account_notification_preferences`. Yerel `.sql` dosyası tutulmadı.
- API TypeScript ve ilgili lint kontrolleri, production web derlemesi ve gerçek Supabase hesaplarıyla varsayılanlar, kısmi/eşzamanlı güncellemeler, yetkilendirme/RLS, zamanlanmış görevde tür filtresi, okundu bilgisinin korunması ve health kontrolü geçti.
- Production Edge oturumlarında üç rolün seçenekleri, anahtarların tema renkleri, gerçek Server Action ile kayıt ve sayfa yenilemesinde kalıcılık doğrulandı. Öğrencide iki tercihin ayrı kaydı, diğer sekmedeki bildirim listesinin güncellenmesi ve 375 px mobil ekranda kayıt kontrol edildi. Web/API derlemeleri geçti; geçici hesap ve içerikler temizlendi.

## İşletim

- API `/v1/health`: süreç ayakta mı? Veritabanından bağımsızdır.
- API `/v1/health/ready`: veritabanı ve hatırlatma görevi sağlıklıysa 200, değilse 503. Veritabanı sorgularının zaman aşımı beş saniyedir. Yayın ortamındaki izleme bu adresi takip etmelidir.
- Supabase → Integrations → Cron → `platform-study-reminders` → History: çalışma geçmişi. Son başarılı çalışmanın zamanını `private.reminder_job_state` tutar.
- API kayıtları `requestId`, HTTP durumu ve süreyi içerir. Web kayıtlarında `event=web_request_failed`, `digest` ve `route` bulunur. Yayın ortamında bu kayıtların saklanması ve 5xx/503 artışına alarm bağlanması gerekir; bu turda harici bir izleme hesabı yapılandırılmadı.
- Hatırlatma görevi gerekirse Cron ekranındaki Active anahtarıyla durdurulabilir. Bu durumda `/v1/health/ready` 503 verir. Cron uzantısını kaldırmak diğer görevleri de siler; görev durdurmak için uzantıyı kaldırmayın.

MCP üzerinden uygulanan migrasyonlar: `add_scheduled_lesson_and_homework_reminders`, `restrict_internal_rls_event_trigger_execution`. Yerel `.sql` dosyası tutulmadı.

## Yayından önce tamamlanması gerekenler

1. **Yedekleme ve geri yükleme.** Supabase Management API kontrolünde `backups=[]`, `pitr_enabled=false`, `walg_enabled=true` döndü. WAL altyapısının açık olması kullanılabilir geri yükleme noktası bulunduğunu kanıtlamaz. Bu turda indirilebilir/geri yüklenebilir yedek doğrulanamadı.
2. **Storage dosyaları.** Veritabanı yedeği yüklenen PDF, resim, ses ve video dosyalarının kendisini içermez. Veritabanı ve Storage için ayrı, erişimi kısıtlı bir yedek hedefi belirlenmeli. Ardından ayrı bir ortamda geri yükleyip kullanıcı, ders, ödev cevapları ve örnek bir dosyanın açıldığı doğrulanmalı. Gerçek projeye geri yükleme yapılmadı.
3. **Yayın ortamı.** Alan adı ve barındırma ortamı belirlendiğinde HTTPS, Supabase site/redirect URL'leri, API `WEB_ORIGIN`, web `API_URL`, sağlık izleme ve log saklama o ortamda doğrulanmalı. Local tarayıcı kontrolü bu dış ortam kontrollerinin yerine geçmez.

Şifre kurtarma kullanıcının isteğiyle kapsam dışında. Güvenlik danışmanında sızmış şifre koruması kapalı görünüyor; Auth ayarları değiştirilmedi. Politikasız RLS bilgileri, yalnızca sunucunun erişmesi gereken ödev kopyası, kredi ve seri tablolarıyla ilgili; istemciye erişim açılmadı.

Kaynaklar: [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [yedeklerin kapsamı ve geri yükleme](https://supabase.com/docs/guides/platform/backups).
