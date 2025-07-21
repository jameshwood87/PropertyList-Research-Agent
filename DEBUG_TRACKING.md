# Debug Tracking - Memory Cleanup Required

## Debug Additions to Remove Later

### 1. Terminal Output Debug Logs
- **Location**: Terminal output during npm install
- **Files**: `25-07-20T15_04_36_485Z-debug-0.log`
- **Action**: Remove debug log files after successful installation

### 2. Next.js Config Warnings
- **Location**: `next.config.js`
- **Issue**: `serverComponentsExternalPackages` moved to `serverExternalPackages`
- **Action**: Update config to use new property name

### 3. API Route Async Issues
- **Location**: `src/app/api/session/[sessionId]/route.ts`
- **Issue**: `params.sessionId` needs to be awaited in Next.js 15
- **Action**: Fix async params handling

### 4. React Version Compatibility
- **Issue**: React 19 not compatible with lucide-react
- **Solution**: Using React 18.2.0 for stability
- **Action**: Monitor for lucide-react React 19 support

### 5. Multiple Lockfile Warning
- **Issue**: Multiple package-lock.json files causing conflicts
- **Action**: Remove conflicting lockfiles and use single one

## Memory Optimization Targets

### High Priority
1. Remove debug console.log statements
2. Clean up unused imports
3. Remove development-only code paths

### Medium Priority
1. Optimize bundle size
2. Remove unused dependencies
3. Clean up temporary files

### Low Priority
1. Optimize image loading
2. Reduce API call frequency
3. Implement proper caching

## Current Status
- ✅ Package.json updated to React 18.2.0
- ✅ Next.js 15.4.2 maintained
- ✅ npm install completed successfully with React 18.3.1
- ✅ Next.js config already correct (serverExternalPackages)
- ✅ API route async issues already fixed (await params)
- ✅ Next.js server running successfully on port 3000
- ✅ React error resolved - server responding with 200 OK
- ✅ Debug console.log statements cleaned up (UTF-8 fix logs removed)
- ✅ PropertyPreview component ready for testing
- ⏳ Need to clean up remaining commented console.log statements

## Success! React Version Issues Resolved
- **Problem**: `TypeError: Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`
- **Solution**: Cleaned up conflicting lockfiles and ensured React 18.3.1 consistency
- **Result**: Server now responds with 200 OK status
- **Next**: PropertyPreview component should work without Webpack errors

## Debug Console.log Statements to Remove
1. **Location**: `src/app/api/session/[sessionId]/route.ts` lines 75-76
   - ✅ `console.log('🔧 Before UTF-8 fix:', data.property.city, data.property.description)` - REMOVED
   - ✅ `console.log('✅ After UTF-8 fix:', data.property.city, data.property.description)` - REMOVED
2. **Location**: `src/app/api/session/[sessionId]/route.ts` line 95
   - `console.log('💾 [CACHE] Cached session: ${sessionId} with TTL: ${ttl}ms')` (commented)
3. **Location**: `src/app/api/session/[sessionId]/route.ts` line 45
   - `console.log(\`📦 [CACHE] Cache hit for session: ${sessionId} (TTL: ${ttl}ms)\`)` (commented) 