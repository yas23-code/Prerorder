import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { UtensilsCrossed } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "vendor">("student");
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, user, userRole } = useAuth();
  const navigate = useNavigate();

  // 🚀 Redirect only when both user + role exist
  useEffect(() => {
    if (!user || userRole === null) return;

    if (userRole === "vendor") {
      navigate("/vendor");
    } else {
      navigate("/student");
    }
  }, [user, userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 12000);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, name, role);
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <UtensilsCrossed className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">CanteenGo</CardTitle>
          <CardDescription>
            Smart food pre-ordering for college students
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs
            value={isLogin ? "login" : "signup"}
            onValueChange={(v) => setIsLogin(v === "login")}
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* SIGN-UP EXTRA FIELDS */}
              <TabsContent value="signup" className="space-y-4">
                <Label>Full Name</Label>
                <Input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                />

                <Label>I am a</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(v) =>
                    setRole(v as "student" | "vendor")
                  }
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="student" id="student" />
                    <Label htmlFor="student">Student</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="vendor" id="vendor" />
                    <Label htmlFor="vendor">Canteen Vendor</Label>
                  </div>
                </RadioGroup>
              </TabsContent>

              {/* COMMON FIELDS */}
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Loading..."
                  : isLogin
                  ? "Sign In"
                  : "Create Account"}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
