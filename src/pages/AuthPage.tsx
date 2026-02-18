import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, LogIn, UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
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
    if (!email.trim() || !phone.trim() || !password || !confirmPassword) {
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
    const error = await signUp(email.trim(), password, email.trim(), phone.trim());
    setLoading(false);
    if (error) {
      toast({ title: "Signup Failed", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Account Created", description: "Welcome to Legal Intelligence Workspace!" });
    navigate("/dashboard");
  };

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
          <div className="space-y-2">
            <Label className="text-foreground">Email</Label>
            <Input
              placeholder="Enter your email"
              type="email"
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
