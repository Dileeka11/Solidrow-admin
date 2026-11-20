<?php

namespace App\Sync;

use RuntimeException;

/** A sync error that retrying will not fix (bad data, conflict on live). */
class PermanentSyncException extends RuntimeException
{
}
