<?php

namespace App\Support;

use Throwable;

/**
 * Small, cached, resized copies of uploaded photos so list views don't
 * download the full original (which can be many MB) for a tiny avatar.
 *
 * Thumbnails are written once to storage/app/public/.thumbs/{width}/… and
 * reused afterwards. Anything that can't be resized safely (no GD, not an
 * image, too large to decode in memory) falls back to the original file.
 */
class MediaThumbnail
{
    /** Allowed widths — keeps the cache small and the URL space bounded. */
    public const WIDTHS = [64, 128, 256, 512];

    /** Skip images whose decoded bitmap would be too large for PHP memory. */
    private const MAX_PIXELS = 50_000_000;

    /**
     * Path of a thumbnail for $source (absolute path), or null to use the original.
     */
    public static function for(string $source, string $relativePath, int $width): ?string
    {
        $width = self::snapWidth($width);
        $target = storage_path('app/public/.thumbs/' . $width . '/' . $relativePath . '.jpg');

        if (is_file($target) && filemtime($target) >= filemtime($source)) {
            return $target;
        }

        try {
            return self::make($source, $target, $width) ? $target : null;
        } catch (Throwable) {
            return null;
        }
    }

    private static function snapWidth(int $width): int
    {
        foreach (self::WIDTHS as $w) {
            if ($width <= $w) {
                return $w;
            }
        }

        return self::WIDTHS[count(self::WIDTHS) - 1];
    }

    private static function make(string $source, string $target, int $width): bool
    {
        if (! function_exists('imagecreatetruecolor')) {
            return false;
        }

        $info = @getimagesize($source);
        if (! $info || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
            return false;
        }

        [$srcW, $srcH] = $info;
        if ($srcW <= 0 || $srcH <= 0 || $srcW * $srcH > self::MAX_PIXELS) {
            return false;
        }

        // Decoding a large phone photo needs room (~5 bytes / pixel).
        $needed = (int) ($srcW * $srcH * 5) + 64 * 1024 * 1024;
        if (self::bytes(ini_get('memory_limit')) < $needed) {
            @ini_set('memory_limit', (string) $needed);
        }

        $src = match ($info[2]) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($source),
            IMAGETYPE_PNG => @imagecreatefrompng($source),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($source) : false,
            IMAGETYPE_GIF => @imagecreatefromgif($source),
        };
        if (! $src) {
            return false;
        }

        // Phone photos store their rotation in EXIF; apply it so the thumbnail
        // is upright like the original shown by the browser.
        if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
            $exif = @exif_read_data($source);
            $angle = match ((int) ($exif['Orientation'] ?? 1)) {
                3 => 180,
                6 => -90,
                8 => 90,
                default => 0,
            };
            if ($angle !== 0 && ($rotated = imagerotate($src, $angle, 0))) {
                unset($src);
                $src = $rotated;
            }
        }

        $srcW = imagesx($src);
        $srcH = imagesy($src);
        if ($srcW <= $width) {
            $width = $srcW;
        }
        $height = max(1, (int) round($srcH * $width / $srcW));

        $dst = imagecreatetruecolor($width, $height);
        // White background so transparent PNGs don't turn black as JPEG.
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $width, $height, $srcW, $srcH);
        unset($src);

        if (! is_dir(dirname($target))) {
            @mkdir(dirname($target), 0755, true);
        }

        $tmp = $target . '.' . uniqid('', true) . '.tmp';
        $ok = imagejpeg($dst, $tmp, 82);
        unset($dst);

        return $ok && @rename($tmp, $target);
    }

    private static function bytes(string|false $value): int
    {
        if ($value === false || $value === '' || $value === '-1') {
            return PHP_INT_MAX;
        }
        $unit = strtolower(substr($value, -1));
        $n = (int) $value;

        return match ($unit) {
            'g' => $n * 1024 ** 3,
            'm' => $n * 1024 ** 2,
            'k' => $n * 1024,
            default => $n,
        };
    }
}
