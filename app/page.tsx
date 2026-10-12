const thinkingPopupStyle: CSSProperties = {
  width: 255,
  padding: "12px 14px 11px",
  borderRadius: 18,
  background: "linear-gradient(180deg, #2a2c31, #17191f)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
};

const thinkingPopupTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
  fontSize: 14,
  marginBottom: 10,
};

const thinkingRangeStyle: CSSProperties = {
  width: "100%",
  accentColor: "#3b82f6",
  cursor: "pointer",
};

const thinkingDotsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "0 9px",
  marginTop: "-13px",
  pointerEvents: "none",
};

const thinkingPillStyle: CSSProperties = {
  minWidth: 145,
  height: 40,
  padding: "0 14px",
  border: 0,
  borderRadius: 999,
  background: "rgba(255,255,255,0.09)",
  color: "#d8d8d8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  cursor: "pointer",
  fontSize: 14,
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(0,0,0,0.72)",
};

const modalStyle: CSSProperties = {
  width: "100%",
  maxWidth: 430,
  maxHeight: "90vh",
  overflowY: "auto",
  padding: 28,
  borderRadius: 24,
  background: "#171a22",
  border: "1px solid rgba(255,255,255,0.1)",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 25,
};

const profilePhotoStyle: CSSProperties = {
  width: 92,
  height: 92,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
  overflow: "hidden",
  fontSize: 32,
};

const profileLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 16,
  fontSize: 12,
  fontWeight: 600,
};

const profileInputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginTop: 7,
  padding: "12px 13px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#101219",
  color: "#fff",
  outline: "none",
};

const saveButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: 14,
  border: 0,
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const signOutButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: 14,
  border: "1px solid rgba(255,80,80,0.35)",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
