import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Mail, Ticket, Loader2, ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const Login = () => {
  const navigate = useNavigate();
  const { isLoggedIn, signInWithOTP, verifyOTP, signInWithGuestToken } = useAuthContext();

  const [activeTab, setActiveTab] = useState<"email" | "guest">("email");

  // Email OTP state
  const [courseCode, setCourseCode] = useState("");
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Guest state
  const [guestCode, setGuestCode] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState("");

  useEffect(() => {
    if (isLoggedIn) navigate("/", { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleRequestOTP = async () => {
    setEmailError("");
    setEmailLoading(true);
    const result = await signInWithOTP(email, courseCode);
    setEmailLoading(false);
    if (result.error) {
      setEmailError(result.error);
    } else {
      setOtpSent(true);
      setCountdown(60);
    }
  };

  const handleVerifyOTP = async () => {
    setEmailError("");
    setEmailLoading(true);
    const result = await verifyOTP(email, otp);
    setEmailLoading(false);
    if (result.error) {
      setEmailError(result.error);
      setOtp("");
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setEmailError("");
    setEmailLoading(true);
    const result = await signInWithOTP(email, courseCode);
    setEmailLoading(false);
    if (result.error) {
      setEmailError(result.error);
    } else {
      setCountdown(60);
    }
  };

  const handleGuestLogin = async () => {
    setGuestError("");
    setGuestLoading(true);
    const result = await signInWithGuestToken(guestCode);
    setGuestLoading(false);
    if (result.error) {
      setGuestError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Anmelden</h1>
          <p className="text-muted-foreground">Melde dich an um deinen Fortschritt zu speichern</p>
        </div>

        {/* Pill Tabs */}
        <div className="bg-secondary p-1 rounded-xl flex mb-6">
          <button
            onClick={() => { setActiveTab("email"); setEmailError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === "email"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="w-4 h-4" /> Mit E-Mail
          </button>
          <button
            onClick={() => { setActiveTab("guest"); setGuestError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === "guest"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ticket className="w-4 h-4" /> Mit Gast-Code
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          {activeTab === "email" && (
            <>
              {!otpSent ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Kurs-Code</label>
                    <input
                      type="text"
                      value={courseCode}
                      onChange={e => setCourseCode(e.target.value.toUpperCase())}
                      placeholder="z.B. WINTER2026"
                      className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">E-Mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="deine@email.de"
                      className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                  <button
                    onClick={handleRequestOTP}
                    disabled={emailLoading || !email || !courseCode}
                    className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Code anfordern
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Wir haben einen 8-stelligen Code an <span className="font-medium text-foreground">{email}</span> gesendet. Prüfe auch deinen Spam-Ordner.
                  </p>
                  <div className="flex justify-center">
                    <InputOTP maxLength={8} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                  <button
                    onClick={handleVerifyOTP}
                    disabled={emailLoading || otp.length < 8}
                    className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Anmelden
                  </button>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      onClick={handleResendOTP}
                      disabled={countdown > 0}
                      className={`${countdown > 0 ? "text-muted-foreground" : "text-primary hover:underline cursor-pointer"}`}
                    >
                      {countdown > 0 ? `Code erneut senden (${countdown}s)` : "Code erneut senden"}
                    </button>
                    <button
                      onClick={() => { setOtpSent(false); setOtp(""); setEmailError(""); }}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" /> Andere E-Mail
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "guest" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Gast-Code</label>
                <input
                  type="text"
                  value={guestCode}
                  onChange={e => setGuestCode(e.target.value.toUpperCase())}
                  placeholder="z.B. GAST-7KM9"
                  className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-mono uppercase"
                />
              </div>
              {guestError && <p className="text-sm text-destructive">{guestError}</p>}
              <button
                onClick={handleGuestLogin}
                disabled={guestLoading || !guestCode}
                className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {guestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Anmelden
              </button>
              <p className="text-sm text-muted-foreground">
                Gast-Code vom Kursleiter erhalten? Gib ihn hier ein.
              </p>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Zurück zur Startseite
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
