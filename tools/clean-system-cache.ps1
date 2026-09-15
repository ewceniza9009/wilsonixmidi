Write-Host "=========================================="
Write-Host "   CLEANING CACHES ON DRIVE C & DRIVE X   "
Write-Host "=========================================="

Write-Host "`n[1/4] Cleaning User Temp directory on Drive C:..."
$tempDir = [System.IO.Path]::GetTempPath()
Write-Host "Target: $tempDir"
$items = Get-ChildItem -Path $tempDir -Force -ErrorAction SilentlyContinue
$cleaned = 0
foreach ($item in $items) {
    try {
        Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction Stop
        $cleaned++
    } catch {
        # file in use, skip silently
    }
}
Write-Host "Cleaned $cleaned top-level temp directories/files."

Write-Host "`n[2/4] Cleaning npm global cache..."
try {
    npm cache clean --force
} catch {
    Write-Host "npm cache clean warning: $_"
}

Write-Host "`n[3/4] Cleaning build and intermediate caches on Drive X:..."
try {
    & "$PSScriptRoot\clean-cache.ps1" -Target all
} catch {
    Write-Host "clean-cache.ps1 warning: $_"
}

Write-Host "`n[4/4] Current Free Disk Space:"
Get-PSDrive -Name C, X -PSProvider FileSystem | Select-Object Name, @{Name='Free (GB)'; Expression={[math]::Round($_.Free / 1GB, 2)}}, @{Name='Used (GB)'; Expression={[math]::Round($_.Used / 1GB, 2)}} | Format-Table -AutoSize

Write-Host "`nCache cleanup completed successfully!"
