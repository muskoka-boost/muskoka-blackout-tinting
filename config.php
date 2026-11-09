<?php
/**
 * Muskoka Blackout Tinting: quote form mail settings.
 *
 * Edit these values on the cPanel server before going live.
 *
 * MAIL_FROM must be an address on the SECONDARY domain that is hosted
 * on this cPanel account (e.g. noreply@your-secondary-domain.ca).
 * Create that mailbox/forwarder in cPanel > Email Accounts, and make sure
 * SPF + DKIM are enabled for that domain in cPanel > Email Deliverability,
 * otherwise Microsoft 365 may junk the messages.
 */
return [
    // Where quote requests are delivered (Braedon's Microsoft 365 inbox).
    'MAIL_TO'        => 'braedon@muskokablackouttinting.com',

    // Sender address on the secondary domain hosted on this server.
    'MAIL_FROM'      => 'noreply@muskokablackouttinting.ca',
    'MAIL_FROM_NAME' => 'Muskoka Blackout Tinting Website',

    'SUBJECT_PREFIX' => 'New quote request',

    // Basic anti-spam: max submissions per IP per hour.
    'RATE_LIMIT_PER_HOUR' => 5,
];
