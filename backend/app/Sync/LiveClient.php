<?php

namespace App\Sync;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Thin HTTP client for the live server's /api/sync endpoints. */
class LiveClient
{
    /** @return array<int,string> paths the live server does not have yet */
    public function missingFiles(array $paths): array
    {
        $response = $this->send(fn (PendingRequest $http) => $http->post($this->url('/files/check'), ['paths' => $paths]));

        return (array) $response->json('missing', []);
    }

    public function uploadFile(string $path, string $absolutePath): void
    {
        $this->send(fn (PendingRequest $http) => $http
            ->timeout(240)
            ->attach('file', fopen($absolutePath, 'r'), basename($path))
            ->post($this->url('/files'), ['path' => $path]));
    }

    public function pushCandidate(array $snapshot): array
    {
        return (array) $this->send(fn (PendingRequest $http) => $http->post($this->url('/candidates'), $snapshot))->json();
    }

    public function deleteCandidate(string $registrationNo): void
    {
        $this->send(fn (PendingRequest $http) => $http->post($this->url('/candidates/delete'), [
            'registration_no' => $registrationNo,
        ]));
    }

    private function send(callable $call): Response
    {
        if (config('sync.target_url') === '' || config('sync.token') === '') {
            throw new RuntimeException('Sync is not configured (SYNC_TARGET_URL / SYNC_TOKEN).');
        }

        $http = Http::withToken(config('sync.token'))
            ->acceptJson()
            ->connectTimeout(15)
            ->timeout(60);

        /** @var Response $response */
        $response = $call($http);

        if ($response->successful()) {
            return $response;
        }

        $message = sprintf('Live sync HTTP %d: %s', $response->status(), mb_substr($response->body(), 0, 500));

        // Data problems (e.g. duplicate NIC on live) will not fix themselves by retrying.
        if (in_array($response->status(), [400, 409, 413, 422], true)) {
            throw new PermanentSyncException($message);
        }

        // Network / auth / server errors: retry later.
        throw new RuntimeException($message);
    }

    private function url(string $path): string
    {
        return config('sync.target_url') . $path;
    }
}
