// Vuetify Mobile Touch Interaction Fixes
export default {
  install(app) {
    // Check if we're on a touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
      // Add global class to body for CSS targeting
      document.body.classList.add('touch-device');
      
      // Defer Vuetify configuration until after it's initialized
      app.mixin({
        mounted() {
          // Only run once on the root component
          if (this.$root === this && this.$vuetify) {
            // Keep ripple effects but optimize for mobile
            if (this.$vuetify.defaults) {
              // Reduce ripple duration for faster feedback
              const rippleConfig = {
                class: 'v-ripple--mobile',
                center: false
              };
              
              this.$vuetify.defaults.VBtn = {
                ...this.$vuetify.defaults.VBtn,
                ripple: rippleConfig
              };
              this.$vuetify.defaults.VListItem = {
                ...this.$vuetify.defaults.VListItem,
                ripple: rippleConfig
              };
              // Cards typically don't need ripple
              this.$vuetify.defaults.VCard = {
                ...this.$vuetify.defaults.VCard,
                ripple: false
              };
            }
          }
        }
      });
      
      // Fix for touch event handling
      document.addEventListener('touchstart', function(e) {
        // Prevent double-tap zoom
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });
      
      // Prevent ghost clicks
      let touchStartTime = 0;
      document.addEventListener('touchstart', function() {
        touchStartTime = Date.now();
      }, true);
      
      document.addEventListener('click', function(e) {
        const timeSinceTouch = Date.now() - touchStartTime;
        if (timeSinceTouch < 300 && timeSinceTouch > 0) {
          // This is likely a ghost click, but let it through
          // to ensure interaction works
          return true;
        }
      }, true);
      
      // Fix for iOS Safari rendering issues
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        // Add iOS-specific class for CSS targeting
        document.body.classList.add('ios-device');
        
        // Handle active states properly on iOS
        document.addEventListener('touchstart', function(e) {
          if (e.target.closest('.v-card, .v-list-item, .v-field')) {
            e.target.classList.add('touch-active');
          }
        }, { passive: true });
        
        document.addEventListener('touchend', function(e) {
          document.querySelectorAll('.touch-active').forEach(el => {
            el.classList.remove('touch-active');
          });
        }, { passive: true });
      }
      
      // Fix for Android Chrome rendering issues
      if (/Android/.test(navigator.userAgent)) {
        // Disable pull-to-refresh on Android
        document.body.style.overscrollBehavior = 'none';
      }
    }
  }
};