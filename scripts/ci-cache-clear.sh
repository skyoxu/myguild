#!/bin/bash

# CI Absolute Safety Cache Clear Script (Bash version)
# Ensures Playwright transform cache is completely cleared in CI environment
# This is a failsafe mechanism for CI pipelines

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[CI-Cache-Clear]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[CI-Cache-Clear]${NC} ✅ $1"
}

log_warning() {
    echo -e "${YELLOW}[CI-Cache-Clear]${NC} ⚠️  $1"
}

log_error() {
    echo -e "${RED}[CI-Cache-Clear]${NC} ❌ $1"
}

# Main cache clearing function
clear_playwright_cache() {
    log_info "Starting CI absolute cache clear process..."
    
    # Method 1: Official Playwright cache clear
    log_info "Attempting official Playwright cache clear..."
    if npx playwright clear-cache 2>/dev/null; then
        log_success "Official cache clear completed"
    else
        log_warning "Official cache clear failed, continuing with manual methods"
    fi
    
    # Method 2: Direct temp directory cleanup
    log_info "Cleaning temp directories..."
    
    # Windows temp (if running in Windows environment like Git Bash)
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        TEMP_DIRS=(
            "$TEMP/playwright-transform-cache"
            "$TMP/playwright-transform-cache" 
            "/tmp/playwright-transform-cache"
            "C:/Windows/Temp/playwright-transform-cache"
        )
    else
        # Unix/Linux temp directories
        TEMP_DIRS=(
            "/tmp/playwright-transform-cache"
            "$HOME/.cache/playwright"
            "$HOME/.cache/ms-playwright"
        )
    fi
    
    for dir in "${TEMP_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            log_info "Removing cache directory: $dir"
            rm -rf "$dir" 2>/dev/null || log_warning "Failed to remove $dir"
        fi
    done
    
    # Method 3: Project-specific cache cleanup
    log_info "Cleaning project-specific cache files..."
    
    PROJECT_CACHE_PATTERNS=(
        ".cache"
        "node_modules/.cache"
        "test-results" 
        "playwright-report"
        ".env.cache-bust"
    )
    
    for pattern in "${PROJECT_CACHE_PATTERNS[@]}"; do
        if [[ -e "$pattern" ]]; then
            log_info "Removing: $pattern"
            rm -rf "$pattern" 2>/dev/null || log_warning "Failed to remove $pattern"
        fi
    done
    
    # Method 4: Environment variable cleanup
    log_info "Cleaning environment variables..."
    unset PW_CACHE_BUST 2>/dev/null || true
    unset PW_CACHE_BUST_TIMESTAMP 2>/dev/null || true
    
    # Method 5: Force regenerate cache bust token
    log_info "Regenerating cache bust token..."
    if [[ -f "scripts/write-cache-bust.js" ]]; then
        node scripts/write-cache-bust.js || log_warning "Failed to regenerate cache bust token"
    fi
    
    log_success "CI absolute cache clear completed successfully"
    log_info "All Playwright tests will now use fresh cache"
}

# Verification function
verify_cache_clear() {
    log_info "Verifying cache clear effectiveness..."
    
    # Check if common cache directories are gone
    CACHE_CLEARED=true
    
    if [[ -d "/tmp/playwright-transform-cache" ]]; then
        log_warning "Transform cache directory still exists"
        CACHE_CLEARED=false
    fi
    
    if [[ -f ".env.cache-bust" ]]; then
        log_info "Cache bust token file exists: $(cat .env.cache-bust | head -1)"
    else
        log_warning "Cache bust token file not found"
    fi
    
    if $CACHE_CLEARED; then
        log_success "Cache clear verification passed"
        return 0
    else
        log_error "Cache clear verification failed"
        return 1
    fi
}

# Main execution
main() {
    log_info "CI Cache Clear Script v1.0"
    log_info "Environment: $OSTYPE"
    log_info "Working directory: $(pwd)"
    
    clear_playwright_cache
    
    if verify_cache_clear; then
        log_success "CI cache clear operation completed successfully"
        exit 0
    else
        log_error "CI cache clear operation completed with warnings"
        exit 1
    fi
}

# Execute main function
main "$@"