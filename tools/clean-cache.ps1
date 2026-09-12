<#
.SYNOPSIS
    Safe Cache & Build Artifact Cleaner for WILSONIX MIDIKEY & Drive X:
    Reclaims gigabytes of disk space safely for Tauri Windows installer builds.

.DESCRIPTION
    Safely targets ONLY ephemeral build caches:
    - Cargo / Rust target directories (src-tauri/target)
    - Vite build distribution (dist)
    - Vite & bundler cache (node_modules/.vite, node_modules/.cache)
    - Android Gradle build outputs (android/app/build, android/.gradle)
    Never deletes any source code, configs, or assets.
#>

param (
    [ValidateSet("midikey", "drive-x", "all")]
    [string]$Target = "midikey"
)

function Get-DriveFreeSpace {
    param([string]$DriveLetter = "X")
    $drive = Get-PSDrive $DriveLetter -ErrorAction SilentlyContinue
    if ($drive) {
        return [math]::Round($drive.Free / 1GB, 2)
    }
    return 0
}

function Safe-RemoveDirectory {
    param([string]$Path, [string]$Description)
    if (Test-Path -LiteralPath $Path) {
        # Strict sanity check: only delete folders explicitly named target, dist, build, .vite, .gradle, .cache
        $leaf = Split-Path -Leaf $Path
        $allowed = @("target", "dist", "build", ".vite", ".gradle", ".cache")
        if ($allowed -contains $leaf) {
            try {
                Write-Host "  [CLEANING] $Description ($Path)..." -ForegroundColor Yellow
                Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
                Write-Host "  [OK] Removed $Description" -ForegroundColor Green
            } catch {
                Write-Host "  [WARNING] Could not remove $Path ($($_.Exception.Message))" -ForegroundColor DarkYellow
            }
        } else {
            Write-Host "  [SKIPPED] Path '$leaf' is not in the safe whitelist." -ForegroundColor Red
        }
    }
}

Clear-Host
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   WILSONIX MIDIKEY - SAFE CACHE CLEANER FOR TAURI INSTALLER" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$initialFree = Get-DriveFreeSpace "X"
Write-Host "Initial Free Space on Drive X: : $initialFree GB" -ForegroundColor White
Write-Host ""

if ($Target -eq "midikey" -or $Target -eq "all") {
    Write-Host "--- 1. Cleaning MIDIKEY Build & Intermediate Caches ---" -ForegroundColor Cyan
    
    # 1. Tauri / Cargo build target
    Safe-RemoveDirectory "X:\midikey\src-tauri\target" "Tauri/Rust build cache"
    
    # 2. Vite distribution
    Safe-RemoveDirectory "X:\midikey\dist" "Vite web build output"
    
    # 3. Vite dev cache
    Safe-RemoveDirectory "X:\midikey\node_modules\.vite" "Vite runtime cache"
    Safe-RemoveDirectory "X:\midikey\node_modules\.cache" "Node bundler cache"
    
    # 4. Android build caches (optional heavy caches from APK builds)
    Safe-RemoveDirectory "X:\midikey\android\app\build" "Android Gradle build outputs"
    Safe-RemoveDirectory "X:\midikey\android\.gradle" "Android Gradle daemon cache"
}

if ($Target -eq "drive-x" -or $Target -eq "all") {
    Write-Host ""
    Write-Host "--- 2. Cleaning Stale Rust/Tauri Targets on Drive X: ---" -ForegroundColor Cyan
    
    $knownTargets = @(
        "X:\midikey\src-tauri\target",
        "X:\pygo\src-tauri\target",
        "X:\pygo\target"
    )
    
    foreach ($tPath in $knownTargets) {
        Safe-RemoveDirectory $tPath "Cargo target cache"
    }
}

$finalFree = Get-DriveFreeSpace "X"
$reclaimed = [math]::Round($finalFree - $initialFree, 2)

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host " Cache cleanup completed successfully and safely!" -ForegroundColor Green
Write-Host " Free Space on Drive X: : $finalFree GB" -ForegroundColor White
if ($reclaimed -gt 0) {
    Write-Host " Reclaimed Space         : +$reclaimed GB" -ForegroundColor Cyan
}
Write-Host " Ready for: npm run build:desktop (Tauri Installer)" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
