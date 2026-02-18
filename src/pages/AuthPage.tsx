import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Scale, LogIn, UserPlus, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup" | "verify-otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const { signIn, signUp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const { error, isAdmin } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      toast({ title: "Login Failed", description: error, variant: "destructive" });
      return;
    }
    navigate(isAdmin ? "/admin" : "/dashboard");
  };

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      toast({ title: "Missing Fields", description: "Please fill all fields", variant: "destructive" });
      return;
    }
    if (!email.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Password Mismatch", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Weak Password", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    const error = await signUp(email.trim(), password, name.trim(), phone.trim());
    setLoading(false);
    if (error) {
      toast({ title: "Signup Failed", description: error, variant: "destructive" });
      return;
    }
    setPendingEmail(email.trim());
    setPendingPassword(password);
    setMode("verify-otp");
    toast({ title: "Verification Code Sent", description: "Check your email for the 6-digit code" });
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    setLoading(true);
    const { error, isAdmin } = await verifyOtp(pendingEmail, otpValue, pendingPassword);
    setLoading(false);
    if (error) {
      toast({ title: "Verification Failed", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Account Verified", description: "Welcome to Legal Intelligence Workspace!" });
    navigate(isAdmin ? "/admin" : "/dashboard");
  };

  const handleResendOtp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: pendingEmail });
    setLoading(false);
    if (error) {
      toast({ title: "Resend Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Code Resent", description: "Check your email for the new code" });
    }
  };

  // OTP Verification Screen
  if (mode === "verify-otp") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Scale className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Verify Your Email</h1>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="text-primary font-medium">{pendingEmail}</span>
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleVerifyOtp}
              disabled={otpValue.length !== 6 || loading}
              className="w-full bg-primary text-primary-foreground hover:bg-gold-bright font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? "Verifying..." : "Verify & Create Account"}
            </Button>

            <div className="flex items-center justify-between">
              <button
                onClick={() => { setMode("signup"); setOtpValue(""); }}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <button
                onClick={handleResendOtp}
                disabled={loading}
                className="text-sm text-primary hover:text-gold-bright font-medium"
              >
                Resend Code
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Scale className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Legal Intelligence Workspace</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label className="text-foreground">Full Name</Label>
              <Input
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-foreground">Email</Label>
            <Input
              placeholder="Enter your email"
              type={mode === "signup" ? "email" : "text"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label className="text-foreground">Phone Number</Label>
              <Input
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-foreground">Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && mode === "login" && handleLogin()}
                className="bg-input border-border text-foreground pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label className="text-foreground">Confirm Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          <Button
            onClick={mode === "login" ? handleLogin : handleSignup}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-gold-bright font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : mode === "login" ? <LogIn className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary hover:text-gold-bright font-medium underline underline-offset-2"
            >
              {mode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
