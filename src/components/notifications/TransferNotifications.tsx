import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { transferApprovalService } from "../../services/transferApprovalService";

interface TransferNotificationsProps {
  onNotificationClick: () => void;
}

const TransferNotifications = ({
  onNotificationClick,
}: TransferNotificationsProps) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPendingTransfers = async () => {
      try {
        setIsLoading(true);
        const { transfers, error } =
          await transferApprovalService.getPendingTransfers();

        if (error) {
          console.warn("Error fetching pending transfers:", error);
          return;
        }

        setPendingCount(transfers.length);
      } catch (error) {
        console.error("Error in fetchPendingTransfers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPendingTransfers();

    const interval = setInterval(fetchPendingTransfers, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Bell className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onNotificationClick}
      className="relative"
    >
      <Bell className="h-4 w-4" />
      {pendingCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {pendingCount}
        </Badge>
      )}
    </Button>
  );
};

export default TransferNotifications;
