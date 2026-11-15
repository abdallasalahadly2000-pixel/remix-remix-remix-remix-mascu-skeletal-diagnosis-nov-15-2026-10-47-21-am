import React from 'react';
import { SensorType } from '../domain/osteosense';

interface SensorHardwareIconProps {
  type: SensorType;
  className?: string;
}

/**
 * Realistic biomedical hardware icon:
 * - QUS: Curved acoustic ultrasound transducer caliper emitting piezo waves
 * - EMG: Dual-snap Ag/AgCl bipolar surface electrode patch with pre-amp pod
 */
export const SensorHardwareIcon: React.FC<SensorHardwareIconProps> = ({
  type,
  className = 'w-4 h-4',
}) => {
  if (type === 'QUS') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {/* Ultrasound transducer handle & collar */}
        <path d="M9 3h6l1 4.5a3 3 0 0 1-1.5 2.6L13 11v2h-2v-2L9.5 10.1A3 3 0 0 1 8 7.5L9 3Z" />
        {/* Acoustic coupling lens */}
        <path d="M8.5 13.5h7" />
        {/* Ultrasonic wave arcs */}
        <path d="M9 16.5a4.5 4.5 0 0 0 6 0" />
        <path d="M6.8 19.2a7.5 7.5 0 0 0 10.4 0" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Stadium adhesive electrode pad */}
      <rect x="2.5" y="6.5" width="19" height="11" rx="5.5" />
      {/* Twin Ag/AgCl snap terminals */}
      <circle cx="7.5" cy="12" r="2" />
      <circle cx="16.5" cy="12" r="2" />
      {/* Central wireless/bus pre-amp bridge */}
      <rect x="10.75" y="9.5" width="2.5" height="5" rx="0.8" />
      {/* Shielded coaxial lead */}
      <path d="M12 6.5V3.5" />
    </svg>
  );
};
