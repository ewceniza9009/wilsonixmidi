# Upload release assets directly via curl.exe for high-speed streaming
$token = (gh auth token).Trim()
$releaseId = (gh api repos/ewceniza9009/wilsonixmidi/releases/tags/v2.0.3 --jq ".id").Trim()

Write-Host "Uploading to Release ID: $releaseId" -ForegroundColor Cyan

# 1. APK
$apkPath = "dist-apk/wilsonix-midikey.apk"
if (Test-Path $apkPath) {
    $apkSize = [math]::Round((Get-Item $apkPath).Length / 1MB, 1)
    Write-Host "`n>>> Uploading wilsonix-midikey.apk ($apkSize MB)..." -ForegroundColor Yellow
    & curl.exe --progress-bar -X POST `
        -H "Authorization: Bearer $token" `
        -H "Content-Type: application/vnd.android.package-archive" `
        --data-binary "@$apkPath" `
        "https://uploads.github.com/repos/ewceniza9009/wilsonixmidi/releases/$releaseId/assets?name=wilsonix-midikey.apk"
    Write-Host "`nAPK upload completed!" -ForegroundColor Green
}

# 2. Windows Installer
$exePath = "dist-installer/WILSONIX.MIDIKEY_2.0.3_x64-setup.exe"
if (Test-Path $exePath) {
    $exeSize = [math]::Round((Get-Item $exePath).Length / 1MB, 1)
    Write-Host "`n>>> Uploading WILSONIX.MIDIKEY_2.0.3_x64-setup.exe ($exeSize MB)..." -ForegroundColor Yellow
    & curl.exe --progress-bar -X POST `
        -H "Authorization: Bearer $token" `
        -H "Content-Type: application/octet-stream" `
        --data-binary "@$exePath" `
        "https://uploads.github.com/repos/ewceniza9009/wilsonixmidi/releases/$releaseId/assets?name=WILSONIX.MIDIKEY_2.0.3_x64-setup.exe"
    Write-Host "`nWindows Installer upload completed!" -ForegroundColor Green
}

Write-Host "`nAll release assets successfully attached to GitHub Release v2.0.3!" -ForegroundColor Cyan
