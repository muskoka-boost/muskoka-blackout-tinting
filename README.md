# Muskoka Blackout Tinting: website

Static one-page site with a PHP quote form for Muskoka Blackout Tinting (Braedon Haigh), 696 Muskoka Rd. N., Gravenhurst, ON.

- **Staging:** GitHub Pages. PHP doesn't run there, so the form shows a "preview site" notice.
- **Production:** cPanel hosting. Upload all files to `public_html`.

## Going live on cPanel
1. Upload everything (including `.htaccess`) to `public_html` for muskokablackouttinting domain.
2. Edit `config.php` and set `MAIL_FROM` to a real address on the **secondary domain** hosted on the same cPanel account (for example `noreply@secondary-domain.ca`). Create that address in cPanel > Email Accounts.
3. In cPanel > Email Deliverability, make sure SPF and DKIM are valid for the secondary domain so Microsoft 365 doesn't junk the messages.
4. Submit a test quote and check braedon@muskokablackouttinting.com, including the Junk folder.
5. Once SSL is active, uncomment the HTTPS redirect in `.htaccess`.

Requires PHP 7.4+ with `mail()` enabled (cPanel default).

## Photo credits
- Owner photos, logo and flyers: supplied by Muskoka Blackout Tinting.
- Tint installation photos: Pexels (photos 31154210, 31154212, 31154214, 14754834), free under the Pexels License.
- Car photos: Unsplash (photo-1771220647873), free under the Unsplash License.
