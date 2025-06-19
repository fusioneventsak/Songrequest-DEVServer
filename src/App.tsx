I notice this file has some syntax errors with mismatched and missing brackets. Here's the corrected version with proper closing brackets added:

The main issues were:

1. A misplaced `</ErrorBoundary>` tag
2. Missing closing brackets for the main component
3. Incorrect nesting of components in the settings tab

Here's the fixed closing section (starting from the settings tab section):

```jsx
              {activeBackendTab === 'settings' && (
                <>
                  <ErrorBoundary>
                    <LogoManager 
                      isAdmin={isAdmin}
                      currentLogoUrl={settings?.band_logo_url || null}
                      onLogoUpdate={handleLogoUpdate}
                    />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <ColorCustomizer isAdmin={isAdmin} />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <SettingsManager />
                  </ErrorBoundary>
                </>
              )}

              {activeBackendTab === 'requests' && (
                <ErrorBoundary>
                  <div className="glass-effect rounded-lg p-6">
                    <h2 className="text-xl font-semibold neon-text mb-4">Current Request Queue</h2>
                    <QueueView 
                      requests={mergedRequests}
                      onLockRequest={handleLockRequest}
                      onMarkPlayed={handleMarkPlayed}
                      onResetQueue={handleResetQueue}
                    />
                  </div>

                  <ErrorBoundary>
                    <TickerManager 
                      nextSong={lockedRequest
                        ? {
                            title: lockedRequest.title,
                            artist: lockedRequest.artist
                          }
                        : undefined
                      }
                      isActive={isTickerActive}
                      customMessage={tickerMessage}
                      onUpdateMessage={setTickerMessage}
                      onToggleActive={() => setIsTickerActive(!isTickerActive)}
                    />
                  </ErrorBoundary>
                </ErrorBoundary>
              )}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Show landing page if no user is set up
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <LandingPage onComplete={handleUserUpdate} />
      </ErrorBoundary>
    );
  }

  // Show main frontend with merged requests and locked song for ticker
  const frontendLockedRequest = mergedRequests.find(r => r.isLocked && !r.isPlayed);
  console.log('🎯 Frontend: Looking for locked request for ticker...', {
    totalRequests: mergedRequests.length,
    lockedRequest: frontendLockedRequest ? {
      id: frontendLockedRequest.id,
      title: frontendLockedRequest.title,
      artist: frontendLockedRequest.artist,
      isLocked: frontendLockedRequest.isLocked,
      isPlayed: frontendLockedRequest.isPlayed
    } : null
  });

  return (
    <ErrorBoundary>
      <UserFrontend 
        songs={songs}
        requests={mergedRequests}
        activeSetList={activeSetList}
        currentUser={currentUser}
        onSubmitRequest={handleSubmitRequest}
        onVoteRequest={handleVoteRequest}
        onUpdateUser={handleUserUpdate}
        logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
        isAdmin={isAdmin}
        onLogoClick={onLogoClick}
        onBackendAccess={navigateToBackend}
        lockedRequest={frontendLockedRequest}
      />
    </ErrorBoundary>
  );
}

export default App;
```

The file now has proper closing brackets and component nesting. The main App component is properly closed and all ErrorBoundary components are properly nested.