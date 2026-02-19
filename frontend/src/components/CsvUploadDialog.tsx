import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    message: string;
    duplicates_detected: number;
    duplicate_tickers: string[];
  } | null>(null);

  const uploadWithStrategy = async (
    file: File,
    strategy: "ask" | "skip" | "replace"
  ) => {
    setError(null);
    setDuplicateInfo(null);
    setUploading(true);
    try {
      const result = await importCsv(file, strategy);
      onSuccess();
      onClose();
      setPendingFile(null);
      if (result?.message) {
        alert(result.message);
      }
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { status?: number; data?: { detail?: unknown } } })
          .response?.status === 409
      ) {
        const detail = (
          err as {
            response?: {
              data?: {
                detail?: {
                  message?: string;
                  duplicates_detected?: number;
                  duplicate_tickers?: string[];
                };
              };
            };
          }
        ).response?.data?.detail;
        if (detail) {
          setDuplicateInfo({
            message: detail.message || "Duplicate records detected.",
            duplicates_detected: detail.duplicates_detected || 0,
            duplicate_tickers: detail.duplicate_tickers || [],
          });
        } else {
          setError("Duplicate records detected. Choose how to proceed.");
        }
      } else {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response
                ?.data?.detail
            : String(err);
        setError(msg || "Import failed");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    await uploadWithStrategy(file, "ask");
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setError(null);
        setDuplicateInfo(null);
        setPendingFile(null);
        onClose();
      }}
      maxWidth="sm"
      fullWidth
    >
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
        {duplicateInfo && pendingFile && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Stack spacing={1}>
              <Typography variant="body2">
                {duplicateInfo.message}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {duplicateInfo.duplicates_detected} duplicate ticker(s):{" "}
                {duplicateInfo.duplicate_tickers.slice(0, 10).join(", ")}
                {duplicateInfo.duplicate_tickers.length > 10 ? "..." : ""}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={uploading}
                  onClick={() => uploadWithStrategy(pendingFile, "skip")}
                >
                  Skip duplicates
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={uploading}
                  onClick={() => uploadWithStrategy(pendingFile, "replace")}
                >
                  Keep latest import
                </Button>
              </Stack>
            </Stack>
          </Alert>
        )}
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setError(null);
            setDuplicateInfo(null);
            setPendingFile(null);
            onClose();
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
