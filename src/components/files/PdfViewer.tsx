import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";
import { Loader2 } from "lucide-react";

export function PdfViewer({ bucket, path, className }: { bucket: string; path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSignedUrl(bucket, path, 3600).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [bucket, path]);

  if (!url) return (
    <div className="h-96 grid place-items-center rounded-md border bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  return <iframe src={url} title="PDF" className={"w-full h-[80vh] rounded-md border " + (className ?? "")} />;
}
