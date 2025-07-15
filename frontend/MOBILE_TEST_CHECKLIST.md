# Mobile Cross-Platform Compatibility Test Checklist

## Test Environments

### iOS Devices
- [ ] iPhone Safari
- [ ] iPhone Chrome
- [ ] iPad Safari
- [ ] iPad Chrome

### Android Devices
- [ ] Android Chrome
- [ ] Android Firefox
- [ ] Android Samsung Internet
- [ ] Android WebView (in-app browser)

### Desktop Touch Devices
- [ ] Windows Touch (Chrome)
- [ ] Windows Touch (Edge)
- [ ] Chrome DevTools Mobile Emulation

## Test Scenarios

### 1. Component Visibility
- [ ] Touch any v-card component - should remain visible
- [ ] Touch any v-list-item - should remain visible
- [ ] Touch any input field - should remain visible and focusable
- [ ] Open dialogs - should display correctly
- [ ] Close dialogs - should animate out properly

### 2. Touch Interactions
- [ ] Tap buttons - should show feedback (ripple or active state)
- [ ] Scroll lists - should be smooth and responsive
- [ ] Swipe navigation drawer - should open/close smoothly
- [ ] Touch and hold - should not cause elements to disappear
- [ ] Multi-touch (pinch/zoom) - should not break UI

### 3. Form Interactions
- [ ] Focus text fields - keyboard should appear properly
- [ ] Type in fields - text should be visible
- [ ] Select dropdowns - options should display correctly
- [ ] Toggle checkboxes - should work on first tap
- [ ] Submit forms - validation messages should appear

### 4. Animations & Transitions
- [ ] Page transitions - should be smooth (150ms)
- [ ] Dialog open/close - should animate properly
- [ ] Dropdown animations - should work correctly
- [ ] Ripple effects - should display (300ms duration)
- [ ] Hover states - should not stick on touch

### 5. Performance Tests
- [ ] Page load time - should not be impacted
- [ ] Scroll performance - should be 60fps
- [ ] Touch responsiveness - immediate feedback
- [ ] Memory usage - no significant increase
- [ ] Battery impact - minimal additional drain

### 6. SQLite Dialog Specific
- [ ] Open new system dialog
- [ ] Select SQLite type
- [ ] Verify host/port fields are hidden
- [ ] Check persistent hints display
- [ ] Test form submission

## Known Issues & Workarounds
1. **iOS Safari**: May need additional `-webkit-` prefixes
2. **Android 6 and below**: Limited CSS Grid support
3. **Samsung Internet**: Different default touch-action behavior

## Validation Criteria
- ✅ No components disappear on touch
- ✅ All animations work smoothly
- ✅ Touch interactions feel responsive
- ✅ No performance degradation
- ✅ Consistent behavior across platforms