<?php

namespace App\Sync;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Node-side HTTP client for the hub's /api/sync endpoints. */
class LiveClient
{
    // ── push ──────────────────────────────────────────────────────────

    /** @return array<int,string> paths the hub does not have yet */
    public function missingFiles(array $paths): array
    {
        return (array) $this->send(fn (PendingRequest $http) => $http->post($this->url('/files/check'), ['paths' => $paths]))
            ->json('missing', []);
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
        return (array) $this->send(fn (PendingRequest $http) => $http
            ->withHeaders(['X-Sync-Station' => config('sync.station_code')])
            ->post($this->url('/candidates'), $snapshot))->json();
    }

    public function deleteCandidate(string $registrationNo): void
    {
        $this->send(fn (PendingRequest $http) => $http
            ->withHeaders(['X-Sync-Station' => config('sync.station_code')])
            ->post($this->url('/candidates/delete'), ['registration_no' => $registrationNo]));
    }

    // ── pull ──────────────────────────────────────────────────────────

    /** @return array{cursor:int, items:array<int,array>} */
    public function changes(int $after): array
    {
        return (array) $this->send(fn (PendingRequest $http) => $http->timeout(120)
            ->get($this->url('/changes'), ['after' => $after]))->json();
    }

    /** Full listing, for the first pull. @return array{next:?int, cursor:int, items:array<int,array>} */
    public function allCandidates(int $afterId): array
    {
        return (array) $this->send(fn (PendingRequest $http) => $http->timeout(120)
            ->get($this->url('/candidates'), ['after_id' => $afterId]))->json();
    }

    /** @return array<string,array<int,array>> table => rows */
    public function masters(): array
    {
        return (array) $this->send(fn (PendingRequest $http) => $http->timeout(120)
            ->get($this->url('/masters')))->json('tables', []);
    }

    public function downloadFile(string $path, string $absoluteTarget): void
    {
        $this->send(fn (PendingRequest $http) => $http->timeout(240)
            ->sink($absoluteTarget)
            ->get($this->url('/files'), ['path' => $path]));
    }

    /** Reserve the next test number for a trade code on the hub. */
    public function reserveTestNumber(string $code): string
    {
        return (string) $this->send(fn (PendingRequest $http) => $http
            ->post($this->url('/test-number'), ['code' => $code]))->json('number');
    }

    // ── plumbing ─────────────────────────────────────────────────────

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

        $message = sprintf('Hub sync HTTP %d: %s', $response->status(), mb_substr($response->body(), 0, 500));

        // Data problems (e.g. duplicate NIC on the hub) will not fix themselves by retrying.
        if (in_array($response->status(), [400, 409, 413, 422], true)) {
            throw new PermanentSyncException($message);
        }

        throw new RuntimeException($message);
    }

    private function url(string $path): string
    {
        return config('sync.target_url') . $path;
    }
}
