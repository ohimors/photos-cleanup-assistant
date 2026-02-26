# Selection Process Sequence Diagram

## Overview

This document describes the flow of the photo selection process, including infinite scroll handling, phase transitions, and timeout management.

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Modal
    participant SelectionLoop
    participant ScrollContainer
    participant GooglePhotos

    User->>Modal: Click "Start Selection"
    Modal->>Modal: Save filters to storage
    Modal->>Modal: Initialize selection state
    Note over Modal: phase = 'scanning'<br/>startTime = now()

    Modal->>SelectionLoop: runSelectionLoop()

    loop Until shouldStop or passedTargetRange
        SelectionLoop->>SelectionLoop: Check timeout (6 min)
        alt Timeout reached
            SelectionLoop->>Modal: showTimeoutPrompt()
            Modal->>User: Display continue/stop options
            User->>Modal: Click Continue or Stop
            Modal->>SelectionLoop: Resume or set shouldStop
        end

        SelectionLoop->>GooglePhotos: findPhotoContainers()
        GooglePhotos-->>SelectionLoop: Array of photo containers

        loop For each container
            SelectionLoop->>SelectionLoop: Generate unique key
            alt Already processed
                SelectionLoop->>SelectionLoop: Skip
            else New photo
                SelectionLoop->>SelectionLoop: Track oldest date in batch

                alt Photo before "from" date
                    SelectionLoop->>SelectionLoop: passedTargetRange = true
                    SelectionLoop->>SelectionLoop: Break loop
                end

                alt Photo within target range & phase == 'scanning'
                    SelectionLoop->>Modal: updateProgressLabel('Selecting...')
                    Note over SelectionLoop: phase = 'selecting'
                end

                alt Matches all filters & not selected
                    SelectionLoop->>GooglePhotos: Click checkbox
                    GooglePhotos-->>SelectionLoop: Photo selected
                    SelectionLoop->>Modal: updateProgressCount(++count)
                end
            end
        end

        SelectionLoop->>Modal: updateProgressStatus(currentDate)

        SelectionLoop->>ScrollContainer: getScrollPosition() [before]
        SelectionLoop->>ScrollContainer: scrollDown()
        SelectionLoop->>SelectionLoop: wait(SCROLL_DELAY)
        SelectionLoop->>ScrollContainer: getScrollPosition() [after]

        alt No scroll progress & has "from" date
            SelectionLoop->>SelectionLoop: stuckAtBottomCount++
            alt stuckAtBottomCount >= 5
                SelectionLoop->>SelectionLoop: Break (end of library)
            end
        else Made progress
            SelectionLoop->>SelectionLoop: stuckAtBottomCount = 0
        end
    end

    SelectionLoop->>Modal: showCompletionState(count)
    Note over Modal: phase = 'complete'
    Modal->>User: Display results with Done button
```

## Phase Transitions

```mermaid
stateDiagram-v2
    [*] --> idle: Modal opened
    idle --> scanning: Start Selection clicked
    scanning --> selecting: First photo in target range found
    scanning --> complete: Passed target range (no matches)
    selecting --> complete: Passed target range
    scanning --> complete: User stops / timeout stop
    selecting --> complete: User stops / timeout stop
    complete --> [*]: Done clicked
```

## Key Components

### Selection State
```javascript
{
  isRunning: boolean,      // Selection loop active
  count: number,           // Photos selected
  shouldStop: boolean,     // User requested stop
  phase: string,           // 'idle' | 'scanning' | 'selecting' | 'complete'
  currentDateViewing: Date, // Oldest photo date in current batch
  startTime: number,       // For timeout tracking
  isPaused: boolean        // Waiting for timeout decision
}
```

### Timing Constants
| Constant | Value | Purpose |
|----------|-------|---------|
| CLICK_DELAY | 17ms | Wait between checkbox clicks |
| SCROLL_DELAY | 200ms | Wait after scrolling for content load |
| TIMEOUT_MS | 360000ms (6 min) | Show timeout prompt |
| MAX_STUCK_AT_BOTTOM | 5 | Retry attempts before giving up |

### Stop Conditions

1. **User stops** - Clicks Stop button or timeout Stop
2. **Passed target range** - Photo date < "from" date filter
3. **End of library** - 5 consecutive scroll attempts with no progress
4. **No "from" date** - Falls back to original behavior (3 no-new-photos cycles or bottom reached)

## Scroll Container Detection

Google Photos uses a custom scrollable container. The extension detects it by trying:
1. `[role="main"]`
2. `.yDSiEe` (Google's scroller class)
3. `[jsname="Zppfte"]`
4. Walk up from photo container to find scrollable parent
5. Fallback to `document.documentElement`
