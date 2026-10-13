import React, { useState } from "react";
import { RotateCw, Shield, QrCode } from "lucide-react";

export default function IdCardFlip() {
  const [isFlipped, setIsFlipped] = useState(false);

  const toggleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFlip();
    }
  };

  return (
    <div className="lp-card-flip-container">
      <button
        type="button"
        className="lp-card-flip-btn"
        aria-pressed={isFlipped}
        aria-label={isFlipped ? "Flip ID card to view front face" : "Flip ID card to view reverse face"}
        onClick={toggleFlip}
        onKeyDown={handleKeyDown}
      >
        <div className="lp-card-flip-inner">
          {/* ════════ FRONT FACE ════════ */}
          <div className="lp-card-flip-face lp-card-flip-front">
            <div className="lp-card-header">
              <div className="lp-card-school-badge">
                <Shield size={16} className="text-white" />
                <span>INSIGHT PUBLIC SCHOOL</span>
              </div>
              <span className="lp-card-type-tag">STUDENT ID</span>
            </div>

            <div className="lp-card-body">
              <div className="lp-card-photo-col">
                <div className="lp-card-photo-frame">
                  <img
                    src="/home/product-idcards.jpg"
                    alt="Student ID card sample photograph"
                    className="lp-card-photo"
                    width={96}
                    height={116}
                    loading="lazy"
                  />
                </div>
                <div className="lp-card-blood-pill">Blood: O+</div>
              </div>

              <div className="lp-card-details-col">
                <h4 className="lp-card-student-name">Aarav Sharma</h4>
                <p className="lp-card-student-role">Class X - Sec A</p>
                <div className="lp-card-meta-list">
                  <div>
                    <span className="lp-card-meta-label">Roll No:</span>
                    <span className="lp-card-meta-val">14</span>
                  </div>
                  <div>
                    <span className="lp-card-meta-label">Adm No:</span>
                    <span className="lp-card-meta-val">INS-2026-8492</span>
                  </div>
                  <div>
                    <span className="lp-card-meta-label">Session:</span>
                    <span className="lp-card-meta-val">2026–2027</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-card-footer">
              <div className="lp-card-chip">
                <span className="lp-card-chip-line" />
                <span className="lp-card-chip-line" />
              </div>
              <div className="lp-card-qr-box">
                <QrCode size={28} className="text-[#1b4a7c]" />
              </div>
            </div>

            <div className="lp-card-flip-hint">
              <RotateCw size={13} className="lp-flip-icon" />
              <span>Click or hover to flip</span>
            </div>
          </div>

          {/* ════════ BACK FACE ════════ */}
          <div className="lp-card-flip-face lp-card-flip-back">
            <div className="lp-card-back-header">
              <span>TERMS &amp; EMERGENCY CONTACT</span>
            </div>

            <div className="lp-card-back-body">
              <div className="lp-card-back-field">
                <span className="lp-card-back-label">Parent / Guardian:</span>
                <span className="lp-card-back-val">R. K. Sharma</span>
              </div>
              <div className="lp-card-back-field">
                <span className="lp-card-back-label">Emergency Phone:</span>
                <span className="lp-card-back-val">+91 81008 79809</span>
              </div>
              <div className="lp-card-back-field">
                <span className="lp-card-back-label">Campus Address:</span>
                <span className="lp-card-back-val">AF-333, Rabindrapally, Kolkata - 700101</span>
              </div>

              <div className="lp-card-back-notice">
                This card is institutional property. If found, please return to the school administration office.
              </div>

              {/* Barcode representation */}
              <div className="lp-card-barcode-box">
                <div className="lp-card-barcode-lines" aria-hidden="true" />
                <span className="lp-card-barcode-text">*INS-2026-8492*</span>
              </div>

              <div className="lp-card-sign-row">
                <div className="lp-card-sign-line">Authorized Signatory</div>
              </div>
            </div>

            <div className="lp-card-flip-hint">
              <RotateCw size={13} className="lp-flip-icon" />
              <span>Click or hover to flip</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
