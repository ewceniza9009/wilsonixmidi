# Upload release assets directly via curl.exe for high-speed streaming with reliable clobber
$ErrorActionPreference = "Stop"

$token = (gh auth token).Trim()
$releaseId = (gh api repos/ewceniza9009/wilsonixmidi/releases/tags/v2.0.3 --jq ".id").Trim()

Write-Host "Target GitHub Release ID: $releaseId (v2.0.3)" -ForegroundColor Cyan

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
Upload-AssetWithClobber "dist-apk/wilsonix-midikey.apk" "wilsonix-midikey.apk" "application/vnd.android.package-archive"

# 2. Windows Installer
Upload-AssetWithClobber "dist-installer/WILSONIX.MIDIKEY_2.0.3_x64-setup.exe" "WILSONIX.MIDIKEY_2.0.3_x64-setup.exe" "application/octet-stream"

Write-Host "`nVerifying release assets on GitHub..." -ForegroundColor Cyan
gh release view v2.0.3
