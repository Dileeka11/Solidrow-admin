<?php
// ONE-TIME helper: creates the storage symlink without a terminal.
// Upload to the document root, open it once in the browser, then DELETE it.

$target = __DIR__ . '/../../registration_app/storage/app/public';
$link   = __DIR__ . '/storage';

if (is_link($link) || file_exists($link)) {
    @unlink($link);
}

if (@symlink($target, $link)) {
    echo "OK: storage symlink created.\n";
} else {
    echo "FAILED: symlink() is blocked on this host.\n";
    echo "Ask your host to run: ln -s $target $link\n";
}
echo "Delete this file now.";
