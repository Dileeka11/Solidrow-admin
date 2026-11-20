<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards /api/sync/*. The endpoints exist only when SYNC_RECEIVE_TOKEN is set,
 * and every call must carry it as a Bearer token.
 */
class VerifySyncToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('sync.receive_token');

        abort_if($expected === '', 404);
        abort_unless(hash_equals($expected, (string) $request->bearerToken()), 401, 'Invalid sync token.');

        return $next($request);
    }
}
