param(
  [Parameter(Mandatory=$true)][string]$InPath,
  [Parameter(Mandatory=$true)][string]$OutPath
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile($InPath)
$w = $src.Width
$h = $src.Height
$bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $w, $h)
$g.Dispose()
$src.Dispose()

$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

# Flood fill from the border: only pixels connected to the outer edge and
# close to white are treated as background. Interior white fur/clothing,
# enclosed by the dark outline strokes, is left untouched.
$whiteish = 232
$minChannel = 210

$visited = New-Object bool[] ($w * $h)
$queue = New-Object System.Collections.Generic.Queue[int]

function Test-Whiteish($off) {
  $b = $bytes[$off]
  $gr = $bytes[$off + 1]
  $r = $bytes[$off + 2]
  $brightness = ($r + $gr + $b) / 3.0
  $minc = [Math]::Min($r, [Math]::Min($gr, $b))
  return ($brightness -ge $whiteish -and $minc -ge $minChannel)
}

for ($x = 0; $x -lt $w; $x++) {
  foreach ($y in 0, ($h - 1)) {
    $idx = $y * $w + $x
    if (-not $visited[$idx]) {
      $off = $y * $stride + $x * 4
      if (Test-Whiteish $off) { $visited[$idx] = $true; $queue.Enqueue($idx) }
    }
  }
}
for ($y = 0; $y -lt $h; $y++) {
  foreach ($x in 0, ($w - 1)) {
    $idx = $y * $w + $x
    if (-not $visited[$idx]) {
      $off = $y * $stride + $x * 4
      if (Test-Whiteish $off) { $visited[$idx] = $true; $queue.Enqueue($idx) }
    }
  }
}

while ($queue.Count -gt 0) {
  $idx = $queue.Dequeue()
  $x = $idx % $w
  $y = [Math]::Floor($idx / $w)
  $off = $y * $stride + $x * 4
  $bytes[$off + 3] = 0

  $neighbors = @(
    @(($x - 1), $y), @(($x + 1), $y), @($x, ($y - 1)), @($x, ($y + 1))
  )
  foreach ($n in $neighbors) {
    $nx = $n[0]; $ny = $n[1]
    if ($nx -ge 0 -and $nx -lt $w -and $ny -ge 0 -and $ny -lt $h) {
      $nidx = $ny * $w + $nx
      if (-not $visited[$nidx]) {
        $noff = $ny * $stride + $nx * 4
        if (Test-Whiteish $noff) {
          $visited[$nidx] = $true
          $queue.Enqueue($nidx)
        }
      }
    }
  }
}

[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
$bmp.UnlockBits($data)

$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Saved $OutPath"
