# Upload release assets directly via curl.exe for high-speed streaming with reliable clobber
param(
    [string]$Tag = ""
)

$ErrorActionPreference = "Stop"

if (-not $Tag) {
    $pkgJson = Get-Content "package.json" | ConvertFrom-Json
    $Tag = "v" + $pkgJson.version
}

$ver = $Tag.TrimStart('v')
Write-Host "Syncing release for Tag: $Tag (Version: $ver)..." -ForegroundColor Cyan

$token = (gh auth token).Trim()
$releaseId = (gh api "repos/ewceniza9009/wilsonixmidi/releases/tags/$Tag" --jq ".id" 2>$null)
if (-not $releaseId) {
    Write-Host "Creating GitHub release $Tag..." -ForegroundColor Yellow
    gh release create $Tag --title "WILSONIX MIDIKEY $Tag (Build 24)" --notes "WILSONIX MIDIKEY $Tag Production Release with Interactive Learning & Piano Tutor Studio, High-Fidelity Korg X5D presets, latency optimizations, and memory leak fixes."
    $releaseId = (gh api "repos/ewceniza9009/wilsonixmidi/releases/tags/$Tag" --jq ".id").Trim()
} else {
    $releaseId = $releaseId.Trim()
}

Write-Host "Target GitHub Release ID: $releaseId ($Tag)" -ForegroundColor Cyan

function Upload-AssetWithClobber($filePath, $assetName, $contentType) {
    if (-not (Test-Path $filePath)) {
        Write-Warning "File not found: $filePath"
        return
    }

    # Clobber: query all assets via GitHub API, delete matching asset ID if it exists
    $allAssets = gh api "repos/ewceniza9009/wilsonixmidi/releases/$releaseId/assets" | ConvertFrom-Json
    $existing = $allAssets | Where-Object { $_.name -eq $assetName }
    if ($existing) {
        Write-Host "Clobbering existing asset: $($existing.name) (ID: $($existing.id))..." -ForegroundColor Magenta
        gh api -X DELETE "repos/ewceniza9009/wilsonixmidi/releases/assets/$($existing.id)" | Out-Null
        Start-Sleep -Seconds 2
    }

    $fileSize = [math]::Round((Get-Item $filePath).Length / 1MB, 1)
    Write-Host "`n>>> Uploading $assetName ($fileSize MB) via high-speed curl..." -ForegroundColor Yellow
    $url = "https://uploads.github.com/repos/ewceniza9009/wilsonixmidi/releases/$releaseId/assets?name=$assetName"

    & curl.exe --progress-bar -X POST `
        -H "Authorization: Bearer $token" `
        -H "Content-Type: $contentType" `
        --data-binary "@$filePath" `
        $url

    Write-Host "`nFinished upload for $assetName!" -ForegroundColor Green
}

# 1. APK
if (Test-Path "dist-apk/wilsonix-midikey.apk") {
    Upload-AssetWithClobber "dist-apk/wilsonix-midikey.apk" "wilsonix-midikey.apk" "application/vnd.android.package-archive"
}

# 2. Windows Installer
$exeCandidates = @(
    "dist-installer/WILSONIX.MIDIKEY_${ver}_x64-setup.exe",
    "dist-installer/WILSONIX MIDIKEY_${ver}_x64-setup.exe",
    "src-tauri/target/release/bundle/nsis/WILSONIX MIDIKEY_${ver}_x64-setup.exe",
    "src-tauri/target/release/bundle/nsis/WILSONIX.MIDIKEY_${ver}_x64-setup.exe"
)

$foundExe = $null
foreach ($c in $exeCandidates) {
    if (Test-Path $c) {
        $foundExe = $c
        break
    }
}

if (-not $foundExe) {
    $anyExe = Get-ChildItem -Path "src-tauri/target/release/bundle/nsis/*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($anyExe) { $foundExe = $anyExe.FullName }
}

if ($foundExe) {
    Upload-AssetWithClobber $foundExe "WILSONIX.MIDIKEY_${ver}_x64-setup.exe" "application/octet-stream"
} else {
    Write-Warning "No Windows setup exe found to upload."
}

# 3. MSI installer if available
$msiCandidates = @(
    "dist-installer/WILSONIX.MIDIKEY_${ver}_x64_en-US.msi",
    "src-tauri/target/release/bundle/msi/WILSONIX MIDIKEY_${ver}_x64_en-US.msi"
)
foreach ($m in $msiCandidates) {
    if (Test-Path $m) {
        Upload-AssetWithClobber $m "WILSONIX.MIDIKEY_${ver}_x64_en-US.msi" "application/octet-stream"
        break
    }
}

Write-Host "`nVerifying release assets on GitHub..." -ForegroundColor Cyan
gh release view $Tag
