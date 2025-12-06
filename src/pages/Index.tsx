import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed, Clock, ShoppingBag, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const navigate = useNavigate();
  const { user, userRole, loading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === "student") {
        navigate("/student");
      } else if (userRole === "vendor") {
        navigate("/vendor");
      }
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh">
      <video
        className="fixed inset-0 w-full h-dvh object-cover object-center z-0 pointer-events-none"
        src="/background_video%20.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/hero-poster.jpg"
      />
      <div className="relative z-10 min-h-dvh bg-gradient-to-br from-primary/5 via-transparent to-secondary/5">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-accent/10 rounded-full">
            <UtensilsCrossed className="h-16 w-16 text-accent" />
          </div>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          CanteenGo
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Skip the queue. Order ahead. Enjoy your meal.
        </p>
        <div className="max-w-3xl mx-auto mb-8">
          <div className="rounded-2xl overflow-hidden shadow-lg bg-black/5">
            <video
              className="w-full h-full"
              autoPlay
              muted
              playsInline
              disablePictureInPicture
              controlsList="nodownload noplaybackrate nofullscreen"
              onContextMenu={(e) => e.preventDefault()}
              poster="/hero-poster.jpg"
              style={{ aspectRatio: "16 / 9", pointerEvents: "none" }}
              preload="auto"
              loop
              ref={videoRef}
            >
              <source src="/video1.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button size="lg" onClick={() => navigate("/auth")} className="shadow-lg">
            Get Started
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center hover:shadow-xl transition-shadow">
            <CardContent className="pt-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-accent/10 rounded-full">
                  <ShoppingBag className="h-10 w-10 text-accent" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Browse & Order</h3>
              <p className="text-muted-foreground">
                View menus from all campus canteens and place your order in seconds
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-xl transition-shadow">
            <CardContent className="pt-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-accent/10 rounded-full">
                  <Clock className="h-10 w-10 text-accent" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Skip the Wait</h3>
              <p className="text-muted-foreground">
                Your food is prepared while you're on your way - no more long queues
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-xl transition-shadow">
            <CardContent className="pt-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-accent/10 rounded-full">
                  <CheckCircle2 className="h-10 w-10 text-accent" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Pick Up & Enjoy</h3>
              <p className="text-muted-foreground">
                Get notified when your order is ready for quick pickup
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-none">
          <CardContent className="py-12">
            <h2 className="text-3xl font-bold mb-4">Ready to save time?</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Join thousands of students who are already skipping the queue
            </p>
            <Button size="lg" onClick={() => navigate("/auth")}>
              Sign Up Now
            </Button>
          </CardContent>
        </Card>
      </section>
      </div>
    </div>
  );
};

export default Index;
