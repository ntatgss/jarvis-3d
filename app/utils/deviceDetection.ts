/**
 * Device detection utilities
 */

/**
 * Checks if the current device is a mobile device
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  // Check if it's a mobile device but exclude Mac Safari
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isMacSafari = /Macintosh/i.test(navigator.userAgent) && /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
  
  // Return true only if it's a mobile device and not Mac Safari
  return isMobile && !isMacSafari;
};

/**
 * Checks if the current device is an iOS device
 */
export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

/**
 * Gets the device type
 */
export const getDeviceType = (): 'mobile' | 'desktop' => {
  return isMobileDevice() ? 'mobile' : 'desktop';
};

/**
 * Checks if the browser supports WebGL
 */
export const supportsWebGL = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
};

/**
 * Checks if the browser supports speech synthesis
 */
export const supportsSpeechSynthesis = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

/**
 * Checks if the browser supports speech recognition
 */
export const supportsSpeechRecognition = (): boolean => {
  return typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 
    'webkitSpeechRecognition' in window
  );
}; 