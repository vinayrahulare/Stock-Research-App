import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import { useRef, useState } from "react";
import { importCsv } from "../api/client";

interface CsvUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CsvUploadDialog({
  open,
  onClose,
  onSuccess,
}: CsvUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const result = await importCsv(file);
      onSuccess();
      onClose();
      if (result?.message) {
        alert(result.message);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : String(err);
      setError(msg || "Import failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import dividend portfolio CSV</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
          Upload a CSV with columns: Ticker, Company, Sector, Price, P/E, Ann.
          Div, Cur. Yield, 5-Yr Avg Yield, Valuation, Payout %, 5-Yr Gr, SI
          Verdict, Why it fits.
        </Typography>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleSelect}
          style={{ display: "none" }}
        />
        <Button
          variant="contained"
          startIcon={<CloudUploadRoundedIcon />}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Choose CSV file"}
        </Button>
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
