<?php

namespace Tests\Feature;

use App\Jobs\PushCandidateToLive;
use App\Models\Candidate;
use App\Models\CandidateDocument;
use App\Models\CandidateSection;
use App\Sync\CandidateSnapshot;
use App\Sync\LiveClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CandidateSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'sync.receive_token' => 'secret',
            'sync.target_url' => 'https://live.test/api/sync',
            'sync.token' => 'secret',
        ]);
        Storage::fake('public');
    }

    private function snapshot(array $candidate = [], array $extra = []): array
    {
        return array_merge([
            'candidate' => array_merge([
                'id' => 999,
                'registration_no' => 'SDW/2026/11/20/1/999',
                'full_name' => 'Test Person',
                'nic' => '200012345678',
                'current_section' => 2,
                'is_completed' => 0,
                'created_at' => '2026-11-20 10:00:00',
                'updated_at' => '2026-11-20 10:00:00',
                'column_only_on_local' => 'x',
            ], $candidate),
            'training' => null,
            'documents' => [
                'id' => 50,
                'candidate_id' => 999,
                'police_certificate' => '[{"path":"candidate-documents/a.pdf","uploaded_at":"2026-11-20"}]',
            ],
            'visa' => null,
            'employee' => null,
            'departure' => null,
            'sections' => [
                ['id' => 1, 'candidate_id' => 999, 'section_no' => 1, 'status' => 'submitted', 'assigned_staff_ids' => '[3]'],
                ['id' => 2, 'candidate_id' => 999, 'section_no' => 2, 'status' => 'pending', 'assigned_staff_ids' => '[]'],
            ],
            'remarks' => [
                ['id' => 7, 'candidate_id' => 999, 'section_no' => 1, 'status' => 'hold', 'reason' => 'Docs pending  ', 'created_at' => '2026-11-20 10:00:00'],
            ],
        ], $extra);
    }

    public function test_endpoints_are_hidden_without_receive_token(): void
    {
        config(['sync.receive_token' => '']);

        $this->postJson('/api/sync/candidates', $this->snapshot())->assertNotFound();
    }

    public function test_wrong_token_is_rejected(): void
    {
        $this->withToken('nope')->postJson('/api/sync/candidates', $this->snapshot())->assertUnauthorized();
    }

    public function test_receiver_inserts_then_updates_only_that_candidate(): void
    {
        $other = Candidate::create(['registration_no' => 'LIVE-ONLY-1', 'full_name' => 'Untouched']);

        $this->withToken('secret')->postJson('/api/sync/candidates', $this->snapshot())->assertOk();

        $live = Candidate::where('registration_no', 'SDW/2026/11/20/1/999')->firstOrFail();
        $this->assertNotSame(999, $live->id, 'local id must not be copied');
        $this->assertSame(2, CandidateSection::where('candidate_id', $live->id)->count());
        $this->assertSame([3], CandidateSection::where('candidate_id', $live->id)->where('section_no', 1)->value('assigned_staff_ids'));
        $this->assertSame('Docs pending  ', DB::table('candidate_remarks')->where('candidate_id', $live->id)->value('reason'));
        $this->assertSame('candidate-documents/a.pdf', CandidateDocument::where('candidate_id', $live->id)->first()->police_certificate[0]['path']);

        // Second push: name changed, a section and the documents row removed.
        $snap = $this->snapshot(['full_name' => 'Renamed'], ['documents' => null]);
        array_pop($snap['sections']);
        $this->withToken('secret')->postJson('/api/sync/candidates', $snap)->assertOk();

        $this->assertSame(2, Candidate::count());
        $this->assertSame('Renamed', $live->fresh()->full_name);
        $this->assertSame(1, CandidateSection::where('candidate_id', $live->id)->count());
        $this->assertSame(0, CandidateDocument::where('candidate_id', $live->id)->count());
        $this->assertSame(1, DB::table('candidate_remarks')->where('candidate_id', $live->id)->count());
        $this->assertSame('Untouched', $other->fresh()->full_name);
    }

    public function test_conflicting_nic_returns_409(): void
    {
        Candidate::create(['registration_no' => 'LIVE-ONLY-1', 'full_name' => 'X', 'nic' => '200012345678']);

        $this->withToken('secret')->postJson('/api/sync/candidates', $this->snapshot())->assertStatus(409);
    }

    public function test_missing_foreign_keys_are_nulled_with_warning(): void
    {
        $res = $this->withToken('secret')->postJson('/api/sync/candidates', $this->snapshot([], [
            'training' => ['id' => 5, 'candidate_id' => 999, 'pre_test_job_category_id' => 12345, 'training_mode' => 'online'],
        ]))->assertOk();

        $this->assertNotEmpty($res->json('warnings'));
        $row = DB::table('candidate_training')->first();
        $this->assertNull($row->pre_test_job_category_id);
        $this->assertSame('online', $row->training_mode);
    }

    public function test_delete(): void
    {
        $this->withToken('secret')->postJson('/api/sync/candidates', $this->snapshot())->assertOk();
        $this->withToken('secret')->postJson('/api/sync/candidates/delete', ['registration_no' => 'SDW/2026/11/20/1/999'])
            ->assertOk()->assertJson(['deleted' => 1]);

        $this->assertSame(0, Candidate::count());
        $this->assertSame(0, CandidateSection::count());
    }

    public function test_file_check_and_upload(): void
    {
        Storage::disk('public')->put('candidates/have.jpg', 'x');

        $this->withToken('secret')->postJson('/api/sync/files/check', [
            'paths' => ['candidates/have.jpg', 'candidates/new.jpg', '../.env'],
        ])->assertOk()->assertExactJson(['missing' => ['candidates/new.jpg']]);

        $this->withToken('secret')->post('/api/sync/files', [
            'path' => 'candidates/new.jpg',
            'file' => UploadedFile::fake()->image('whatever.jpg'),
        ])->assertOk();
        Storage::disk('public')->assertExists('candidates/new.jpg');

        $this->withToken('secret')->post('/api/sync/files', [
            'path' => '../evil.php',
            'file' => UploadedFile::fake()->create('evil.php'),
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_job_uploads_missing_files_then_pushes_snapshot(): void
    {
        $candidate = Candidate::create([
            'registration_no' => 'SDW/LOCAL/1',
            'full_name' => 'Local Person',
            'passport_image' => 'candidates/p.jpg',
        ]);
        Storage::disk('public')->put('candidates/p.jpg', 'img');
        CandidateDocument::create([
            'candidate_id' => $candidate->id,
            'working_experience' => ['candidate-documents/w1.pdf'],
        ]);
        Storage::disk('public')->put('candidate-documents/w1.pdf', 'pdf');

        $this->assertEqualsCanonicalizing(
            ['candidates/p.jpg', 'candidate-documents/w1.pdf'],
            CandidateSnapshot::filePaths(CandidateSnapshot::build($candidate->id))
        );

        Http::fake([
            '*/files/check' => Http::response(['missing' => ['candidates/p.jpg']]),
            '*/files' => Http::response(['ok' => true]),
            '*/candidates' => Http::response(['ok' => true, 'warnings' => []]),
        ]);

        (new PushCandidateToLive($candidate->id))->handle(app(LiveClient::class));

        $urls = collect(Http::recorded())->map(fn ($pair) => $pair[0]->url())->all();
        $this->assertSame([
            'https://live.test/api/sync/files/check',
            'https://live.test/api/sync/files',
            'https://live.test/api/sync/candidates',
        ], $urls);

        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/candidates')
            && $r->hasHeader('Authorization', 'Bearer secret')
            && $r['candidate']['registration_no'] === 'SDW/LOCAL/1');
    }

    public function test_observer_queues_push_when_enabled(): void
    {
        \Illuminate\Support\Facades\Queue::fake();
        config(['sync.push_enabled' => true]);
        (new \App\Providers\AppServiceProvider($this->app))->boot();

        Candidate::create(['registration_no' => 'SDW/LOCAL/2', 'full_name' => 'Q']);

        \Illuminate\Support\Facades\Queue::assertPushed(PushCandidateToLive::class);
    }
}
