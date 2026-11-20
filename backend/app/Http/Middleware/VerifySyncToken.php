<?php

namespace App\Http\Middleware;

use App\Sync\Sync;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards /api/sync/*. The endpoints exist only on the hub (SYNC_ROLE=hub with
 * SYNC_TOKEN set), and every call must carry that token as a Bearer token.
 */
class VerifySyncToken
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(Sync::isHub(), 404);
        abort_unless(hash_equals((string) config('sync.token'), (string) $request->bearerToken()), 401, 'Invalid sync token.');

        return $next($request);
    }
}
