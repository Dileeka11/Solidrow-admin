<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    | Ozone Sender SMS gateway.
    | driver: "log" writes messages to the log only (safe for testing);
    |         "ozone" performs a real API call to the endpoint below.
    */
    'ozone' => [
        'driver'    => env('SMS_DRIVER', 'ozone'),
        'endpoint'  => env('OZONE_SMS_ENDPOINT', 'https://api.ozonesender.com/v1/send/'),
        'user_id'   => env('OZONE_SMS_USER_ID', '110560'),
        'api_key'   => env('OZONE_SMS_API_KEY', 'h93Veu1OQ155vWp'),
        'sender_id' => env('OZONE_SMS_SENDER_ID', 'Solidrow'),
    ],

];
