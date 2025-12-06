export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });
  }
};

export const showOrderReadyNotification = (orderDetails: {
  canteenName: string;
  totalAmount: number;
}) => {
  showNotification("Your Order is Ready! 🎉", {
    body: `Your order from ${orderDetails.canteenName} (₹${orderDetails.totalAmount.toFixed(2)}) is ready for pickup!`,
    tag: "order-ready",
    requireInteraction: true,
  });
};
