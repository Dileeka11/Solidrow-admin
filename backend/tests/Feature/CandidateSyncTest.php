<?php

namespace Tests\Feature;

use App\Jobs\PushCandidateToLive;
use App\Models\Candidate;
use App\Models\CandidateDocument;
use App\Models\CandidateSection;
use App\Providers\AppServiceProvider;
use App\Sync\CandidateSnapshot;
use App\Sync\LiveClient;
use App\Sync\Puller;
use App\Sync\SyncState;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CandidateSyncTest extends TestCase
{
    use RefreshDatabase;

    private const REG = 'SDW/2026/11/20/1/PC1-999';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'sync.role' => 'hub',
            'sync.token' => 'secret',
            'sync.target_url' => 'https://live.test/api/sync',
            'sync.station_code' => 'PC1',
        ]);
        Storage::fake('public');
    }

    private function asNode(): void
    {
        config(['sync.role' => 'node']);
    }

    private function snapshot(array $candidate = [], array $extra = []): array
    {
        return array_merge([
            'candidate' => array_merge([
                'id' => 999,
                'registration_no' => self::REG,
                'full_name' => 'Test Person',
                'nic' => '200012345678',
                'current_section' => 2,
                'is_completed' => 0,
                'created_at' => '2026-11-20 10:00:00',
                'updated_at' => '2026-11-20 10:00:00',
                'column_only_on_pc' => 'x',
            ], $candidate),
            'training' => null,
            'documents' => [
                'id' => 50,
                'candidate_id' => 999,
                'police_certificate' => '[{"path":"candidate-documents/a.pdf","uploaded_at":"2026-11-20"}]',
                'updated_at' => '2026-11-20 10:00:00',
            ],
            'visa' => null,
            'employee' => null,
            'departure' => null,
            'sections' => [
                ['id' => 1, 'candidate_id' => 999, 'section_no' => 1, 'status' => 'submitted', 'assigned_staff_ids' => '[3]', 'updated_at' => '2026-11-20 10:00:00'],
                ['id' => 2, 'candidate_id' => 999, 'section_no' => 2, 'status' => 'pending', 'assigned_staff_ids' => '[]', 'updated_at' => '2026-11-20 10:00:00'],
            ],
            'remarks' => [
                ['id' => 7, 'candidate_id' => 999, 'section_no' => 1, 'status' => 'hold', 'reason' => 'Docs pending  ', 'created_at' => '2026-11-20 10:00:00', 'updated_at' => '2026-11-20 10:00:00'],
            ],
        ], $extra);
    }

    private function push(array $snapshot)
    {
        return $this->withToken('secret')->withHeader('X-Sync-Station', 'PC1')->postJson('/api/sync/candidates', $snapshot);
    }

    // ── hub endpoints ────────────────────────────────────────────────

    public function test_endpoints_exist_only_on_the_hub(): void
    {
        $this->asNode();
        $this->withToken('secret')->postJson('/api/sync/candidates', $this->snapshot())->assertNotFound();
    }

    public function test_wrong_token_is_rejected(): void
    {
        $this->withToken('nope')->postJson('/api/sync/candidates', $this->snapshot())->assertUnauthorized();
    }

    public function test_push_inserts_and_logs_only_that_candidate(): void
    {
        $other = Candidate::create(['registration_no' => 'LIVE-1', 'full_name' => 'Untouched']);
        DB::table('sync_changes')->delete();

        $this->push($this->snapshot())->assertOk();

        $live = Candidate::where('registration_no', self::REG)->firstOrFail();
        $this->assertNotSame(999, $live->id, 'PC ids must not be copied');
        $this->assertSame(2, CandidateSection::where('candidate_id', $live->id)->count());
        $this->assertSame([3], CandidateSection::where('candidate_id', $live->id)->where('section_no', 1)->value('assigned_staff_ids'));
        $this->assertSame('Docs pending  ', DB::table('candidate_remarks')->where('candidate_id', $live->id)->value('reason'));
        $this->assertSame('candidate-documents/a.pdf', CandidateDocument::where('candidate_id', $live->id)->first()->police_certificate[0]['path']);
        $this->assertSame('Untouched', $other->fresh()->full_name);
        $this->assertSame([self::REG], DB::table('sync_changes')->pluck('registration_no')->all());
        $this->assertSame('PC1', DB::table('sync_changes')->value('station'));
    }

    public function test_newer_row_wins_per_row_and_progress_only_moves_forward(): void
    {
        $this->push($this->snapshot())->assertOk();

        // PC2 (older edit of the candidate row, newer edit of documents, section 2 submitted)
        $snap = $this->snapshot(
            ['full_name' => 'Stale name', 'current_section' => 3, 'updated_at' => '2026-11-20 09:00:00'],
            ['documents' => ['cv_copy' => 'candidate-documents/cv.pdf', 'updated_at' => '2026-11-20 11:00:00']]
        );
        $snap['sections'][1] = ['section_no' => 2, 'status' => 'submitted', 'assigned_staff_ids' => '[]', 'updated_at' => '2026-11-20 11:00:00'];
        $snap['remarks'][] = ['section_no' => 2, 'status' => 'ok', 'reason' => 'second', 'created_at' => '2026-11-20 11:00:00'];
        $this->push($snap)->assertOk();

        $c = Candidate::where('registration_no', self::REG)->first();
        $this->assertSame('Test Person', $c->full_name, 'older candidate row must not overwrite');
        $this->assertSame(3, (int) $c->current_section, 'progress moves forward');
        $this->assertSame('candidate-documents/cv.pdf', CandidateDocument::where('candidate_id', $c->id)->value('cv_copy'));
        $this->assertSame('submitted', CandidateSection::where('candidate_id', $c->id)->where('section_no', 2)->value('status'));
        $this->assertSame(2, DB::table('candidate_remarks')->where('candidate_id', $c->id)->count(), 'remarks are unioned, not duplicated');

        // Same snapshot again changes nothing.
        $this->push($snap)->assertOk();
        $this->assertSame(2, DB::table('candidate_remarks')->where('candidate_id', $c->id)->count());
    }

    public function test_conflicting_nic_returns_409(): void
    {
        Candidate::create(['registration_no' => 'LIVE-1', 'full_name' => 'X', 'nic' => '200012345678']);

        $this->push($this->snapshot())->assertStatus(409);
    }

    public function test_missing_foreign_keys_are_nulled_with_warning(): void
    {
        $res = $this->push($this->snapshot([], [
            'training' => ['pre_test_job_category_id' => 12345, 'training_mode' => 'online', 'updated_at' => '2026-11-20 10:00:00'],
        ]))->assertOk();

        $this->assertNotEmpty($res->json('warnings'));
        $row = DB::table('candidate_training')->first();
        $this->assertNull($row->pre_test_job_category_id);
        $this->assertSame('online', $row->training_mode);
    }

    public function test_delete_is_logged_and_old_pushes_do_not_resurrect(): void
    {
        $this->push($this->snapshot())->assertOk();
        $this->withToken('secret')->postJson('/api/sync/candidates/delete', ['registration_no' => self::REG])
            ->assertOk()->assertJson(['deleted' => 1]);

        $this->assertSame(0, Candidate::count());
        $this->assertSame(0, CandidateSection::count());
        $this->assertSame(1, (int) DB::table('sync_changes')->where('deleted', true)->count());

        // A PC that edited it before the delete pushes late → stays deleted.
        $this->push($this->snapshot())->assertOk()->assertJson(['skipped' => 'deleted']);
        $this->assertSame(0, Candidate::count());
    }

    public function test_changes_feed_returns_snapshots_and_tombstones(): void
    {
        $this->push($this->snapshot())->assertOk();
        $this->push($this->snapshot(['registration_no' => 'SDW/X/2', 'nic' => null]))->assertOk();
        $this->withToken('secret')->postJson('/api/sync/candidates/delete', ['registration_no' => 'SDW/X/2'])->assertOk();

        $res = $this->withToken('secret')->getJson('/api/sync/changes?after=0')->assertOk();

        $items = collect($res->json('items'))->keyBy('registration_no');
        $this->assertSame('Test Person', $items[self::REG]['snapshot']['candidate']['full_name']);
        $this->assertTrue($items['SDW/X/2']['deleted']);
        $this->assertSame((int) DB::table('sync_changes')->max('id'), $res->json('cursor'));

        $this->withToken('secret')->getJson('/api/sync/changes?after=' . $res->json('cursor'))
            ->assertOk()->assertJson(['items' => []]);
    }

    public function test_live_site_edits_are_logged_for_the_pcs(): void
    {
        (new AppServiceProvider($this->app))->boot(); // hub observers

        $c = Candidate::create(['registration_no' => 'LIVE-EDIT', 'full_name' => 'A']);
        $c->update(['full_name' => 'B']);
        $c->delete();

        $rows = DB::table('sync_changes')->where('registration_no', 'LIVE-EDIT')->orderBy('id')->pluck('deleted')->map(fn ($d) => (bool) $d)->all();
        $this->assertSame([false, false, true], $rows);
    }

    public function test_file_check_upload_and_download(): void
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

        $this->withToken('secret')->get('/api/sync/files?path=candidates/have.jpg')->assertOk();
        $this->withToken('secret')->get('/api/sync/files?path=../.env')->assertNotFound();
    }

    public function test_hub_issues_unique_test_numbers(): void
    {
        $a = $this->withToken('secret')->postJson('/api/sync/test-number', ['code' => 'ti'])->assertOk()->json('number');
        $b = $this->withToken('secret')->postJson('/api/sync/test-number', ['code' => 'TI'])->assertOk()->json('number');

        $this->assertSame(['TI001', 'TI002'], [$a, $b]);
    }

    public function test_masters_endpoint_lists_configured_tables(): void
    {
        DB::table('job_categories')->insert(['name' => 'Welder', 'code' => 'WE', 'created_at' => now(), 'updated_at' => now()]);

        $tables = $this->withToken('secret')->getJson('/api/sync/masters')->assertOk()->json('tables');

        $this->assertSame('WE', $tables['job_categories'][0]['code']);
        $this->assertArrayNotHasKey('candidates', $tables);
    }

    // ── node side ────────────────────────────────────────────────────

    public function test_node_registration_numbers_carry_the_pc_code(): void
    {
        $this->asNode();
        $user = \App\Models\User::factory()->create(['username' => 'pc1user']);

        $no = $this->actingAs($user, 'sanctum')->getJson('/api/candidates/next-registration-no')->json('registration_no');

        $this->assertMatchesRegularExpression('#^SDW/\d{4}/\d{2}/\d{2}/\d+/PC1-\d+$#', $no);
    }

    public function test_node_observer_queues_push(): void
    {
        Queue::fake();
        $this->asNode();
        (new AppServiceProvider($this->app))->boot();

        Candidate::create(['registration_no' => 'SDW/LOCAL/2', 'full_name' => 'Q']);

        Queue::assertPushed(PushCandidateToLive::class);
    }

    public function test_push_job_uploads_missing_files_then_pushes(): void
    {
        $this->asNode();
        $candidate = Candidate::create(['registration_no' => 'SDW/LOCAL/1', 'full_name' => 'L', 'passport_image' => 'candidates/p.jpg']);
        Storage::disk('public')->put('candidates/p.jpg', 'img');
        CandidateDocument::create(['candidate_id' => $candidate->id, 'working_experience' => ['candidate-documents/w1.pdf']]);
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

        $this->assertSame(
            ['https://live.test/api/sync/files/check', 'https://live.test/api/sync/files', 'https://live.test/api/sync/candidates'],
            collect(Http::recorded())->map(fn ($pair) => $pair[0]->url())->all()
        );
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/candidates')
            && $r->hasHeader('Authorization', 'Bearer secret')
            && $r->hasHeader('X-Sync-Station', 'PC1')
            && $r['candidate']['registration_no'] === 'SDW/LOCAL/1');
    }

    public function test_pull_applies_changes_downloads_files_and_deletes(): void
    {
        $this->asNode();
        Candidate::create(['registration_no' => 'GONE-1', 'full_name' => 'Deleted elsewhere']);
        $snap = $this->snapshot(['passport_image' => 'candidates/remote.jpg']);

        Http::fake([
            'live.test/api/sync/changes?after=0' => Http::response(['cursor' => 7, 'items' => [
                ['registration_no' => self::REG, 'deleted' => false, 'snapshot' => $snap],
                ['registration_no' => 'GONE-1', 'deleted' => true],
            ]]),
            'live.test/api/sync/changes?after=7' => Http::response(['cursor' => 7, 'items' => []]),
            'live.test/api/sync/files*' => Http::response('jpegbytes'),
        ]);

        $applied = app(Puller::class)->pullChanges();

        $this->assertSame(2, $applied);
        $this->assertSame('Test Person', Candidate::where('registration_no', self::REG)->value('full_name'));
        $this->assertNull(Candidate::where('registration_no', 'GONE-1')->first());
        $this->assertSame('jpegbytes', Storage::disk('public')->get('candidates/remote.jpg'));
        $this->assertSame('7', SyncState::get('changes_cursor'));
    }

    public function test_pull_masters_mirrors_hub_tables(): void
    {
        $this->asNode();
        DB::table('job_categories')->insert(['id' => 1, 'name' => 'Old', 'created_at' => now(), 'updated_at' => now()]);

        Http::fake(['live.test/api/sync/masters' => Http::response(['tables' => [
            'job_categories' => [['id' => 5, 'name' => 'Welder', 'code' => 'WE', 'hub_only_col' => 1]],
            'candidates' => [['id' => 1, 'registration_no' => 'NOPE', 'full_name' => 'x']],
        ]])]);

        app(Puller::class)->pullMasters();

        $this->assertSame([5], DB::table('job_categories')->pluck('id')->all());
        $this->assertSame(0, Candidate::count(), 'only configured master tables are replaced');
    }

    public function test_node_test_number_comes_from_the_hub(): void
    {
        $this->asNode();
        Http::fake(['live.test/api/sync/test-number' => Http::response(['number' => 'TI042'])]);

        $this->assertSame('TI042', app(\App\Services\TestNumberService::class)->next('TI'));
    }
}
