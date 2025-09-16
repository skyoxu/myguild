# CI Absolute Safety Cache Clear Script (PowerShell version)
# Ensures Playwright transform cache is completely cleared in CI environment
# This is a failsafe mechanism for Windows CI pipelines

param(
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Continue"

# Color functions for output
function Write-Info {
    param([string]$Message)
    Write-Host "[CI-Cache-Clear] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[CI-Cache-Clear] ✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[CI-Cache-Clear] ⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[CI-Cache-Clear] ❌ $Message" -ForegroundColor Red
}

# Main cache clearing function
function Clear-PlaywrightCache {
    Write-Info "Starting CI absolute cache clear process..."
    
    # Method 1: Official Playwright cache clear
    Write-Info "Attempting official Playwright cache clear..."
    try {
        $null = npx playwright clear-cache 2>$null
        Write-Success "Official cache clear completed"
    }
    catch {
        Write-Warning "Official cache clear failed, continuing with manual methods"
    }
    
    # Method 2: Direct temp directory cleanup
    Write-Info "Cleaning Windows temp directories..."
    
    $TempDirs = @(
        "$env:TEMP\playwright-transform-cache",
        "$env:TMP\playwright-transform-cache", 
        "C:\Windows\Temp\playwright-transform-cache",
        "$env:USERPROFILE\.cache\playwright",
        "$env:USERPROFILE\.cache\ms-playwright",
        "$env:LOCALAPPDATA\Temp\playwright-transform-cache"
    )
    
    foreach ($dir in $TempDirs) {
        if (Test-Path $dir -PathType Container) {
            Write-Info "Removing cache directory: $dir"
            try {
                Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
                Write-Success "Removed: $dir"
            }
            catch {
                Write-Warning "Failed to remove: $dir"
            }
        }
    }
    
    # Method 3: Project-specific cache cleanup
    Write-Info "Cleaning project-specific cache files..."
    
    $ProjectCachePatterns = @(
        ".cache",
        "node_modules\.cache",
        "test-results", 
        "playwright-report",
        ".env.cache-bust"
    )
    
    foreach ($pattern in $ProjectCachePatterns) {
        if (Test-Path $pattern) {
            Write-Info "Removing: $pattern"
            try {
                Remove-Item -Path $pattern -Recurse -Force -ErrorAction SilentlyContinue
                Write-Success "Removed: $pattern"
            }
            catch {
                Write-Warning "Failed to remove: $pattern"
            }
        }
    }
    
    # Method 4: Environment variable cleanup
    Write-Info "Cleaning environment variables..."
    try {
        Remove-Item -Path "env:PW_CACHE_BUST" -ErrorAction SilentlyContinue
        Remove-Item -Path "env:PW_CACHE_BUST_TIMESTAMP" -ErrorAction SilentlyContinue
    }
    catch {
        # Silently continue if env vars don't exist
    }
    
    # Method 5: Force regenerate cache bust token
    Write-Info "Regenerating cache bust token..."
    if (Test-Path "scripts\write-cache-bust.js") {
        try {
            node scripts\write-cache-bust.js
            Write-Success "Cache bust token regenerated"
        }
        catch {
            Write-Warning "Failed to regenerate cache bust token"
        }
    }
    
    # Method 6: Windows-specific registry cleanup (if needed)
    Write-Info "Checking Windows registry for Playwright entries..."
    try {
        # Note: Only clean up if absolutely necessary and safe
        # This is a placeholder for potential registry cleanup
        Write-Info "Registry cleanup skipped (not required for current issue)"
    }
    catch {
        Write-Warning "Registry cleanup failed or not accessible"
    }
    
    Write-Success "CI absolute cache clear completed successfully"
    Write-Info "All Playwright tests will now use fresh cache"
}

# Verification function
function Test-CacheClear {
    Write-Info "Verifying cache clear effectiveness..."
    
    $CacheCleared = $true
    
    # Check if common cache directories are gone
    $CommonCacheDirs = @(
        "$env:TEMP\playwright-transform-cache",
        "$env:USERPROFILE\.cache\playwright"
    )
    
    foreach ($dir in $CommonCacheDirs) {
        if (Test-Path $dir -PathType Container) {
            Write-Warning "Transform cache directory still exists: $dir"
            $CacheCleared = $false
        }
    }
    
    # Check cache bust token
    if (Test-Path ".env.cache-bust") {
        $tokenContent = Get-Content ".env.cache-bust" -First 1
        Write-Info "Cache bust token file exists: $tokenContent"
    }
    else {
        Write-Warning "Cache bust token file not found"
    }
    
    # Check environment variables
    if ($env:PW_CACHE_BUST) {
        Write-Info "PW_CACHE_BUST environment variable: $env:PW_CACHE_BUST"
    }
    
    if ($CacheCleared) {
        Write-Success "Cache clear verification passed"
        return $true
    }
    else {
        Write-Error-Custom "Cache clear verification failed"
        return $false
    }
}

# Main execution function
function Main {
    Write-Info "CI Cache Clear Script v1.0 (PowerShell)"
    Write-Info "OS Version: $((Get-CimInstance Win32_OperatingSystem).Caption)"
    Write-Info "PowerShell Version: $($PSVersionTable.PSVersion)"
    Write-Info "Working directory: $(Get-Location)"
    
    Clear-PlaywrightCache
    
    if (Test-CacheClear) {
        Write-Success "CI cache clear operation completed successfully"
        exit 0
    }
    else {
        Write-Error-Custom "CI cache clear operation completed with warnings"
        exit 1
    }
}

# Execute main function
try {
    Main
}
catch {
    Write-Error-Custom "Script execution failed: $_"
    exit 1
}