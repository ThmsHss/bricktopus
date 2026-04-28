import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useConnectInfo,
  useConnectNotion,
  useConnectSalesforce,
  useDisconnectNotionAction,
  useDisconnectSalesforceAction,
  type SourceName,
  type SourceStatus,
} from "@/hooks/use-sources";

interface ConnectModalProps {
  source: SourceStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectModal({ source, open, onOpenChange }: ConnectModalProps) {
  if (!source) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{source.label}</DialogTitle>
          <DialogDescription>{source.detail}</DialogDescription>
        </DialogHeader>
        {source.connect_kind === "token" && (
          <NotionForm source={source.name} onDone={() => onOpenChange(false)} />
        )}
        {source.connect_kind === "credentials" && (
          <SalesforceForm
            source={source.name}
            onDone={() => onOpenChange(false)}
          />
        )}
        {source.connect_kind === "oauth-external" && (
          <SetupGuide source={source.name} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SetupGuide({ source }: { source: SourceName }) {
  const { data, isLoading } = useConnectInfo(source);
  if (isLoading) return <Spinner />;
  if (!data) return null;
  return (
    <div className="space-y-3">
      <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        {data.instructions}
      </pre>
      {data.docs_url && (
        <a
          href={data.docs_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Open setup docs
        </a>
      )}
    </div>
  );
}

function NotionForm({
  source,
  onDone,
}: {
  source: SourceName;
  onDone: () => void;
}) {
  const { data: info } = useConnectInfo(source);
  const connect = useConnectNotion();
  const disconnect = useDisconnectNotionAction();
  const [token, setToken] = useState("");
  const [databaseId, setDatabaseId] = useState("");

  useEffect(() => {
    if (!connect.isSuccess) return;
    onDone();
  }, [connect.isSuccess, onDone]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        connect.mutate({
          token: token.trim(),
          database_id: databaseId.trim() || undefined,
        });
      }}
      className="space-y-4"
    >
      {info?.instructions && (
        <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {info.instructions}
        </pre>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="notion-token">Integration token</Label>
        <Input
          id="notion-token"
          type="password"
          placeholder="secret_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notion-db">Database id (optional)</Label>
        <Input
          id="notion-db"
          placeholder="32-character database id"
          value={databaseId}
          onChange={(e) => setDatabaseId(e.target.value)}
          autoComplete="off"
        />
      </div>
      {info?.docs_url && (
        <a
          href={info.docs_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Notion integration docs
        </a>
      )}
      {connect.isError && (
        <p className="text-xs text-destructive">
          Couldn't save: {(connect.error as Error)?.message ?? "unknown error"}
        </p>
      )}
      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
        >
          {disconnect.isPending && (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          )}
          Disconnect
        </Button>
        <Button type="submit" disabled={!token || connect.isPending}>
          {connect.isPending && (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          )}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function SalesforceForm({
  source,
  onDone,
}: {
  source: SourceName;
  onDone: () => void;
}) {
  const { data: info } = useConnectInfo(source);
  const connect = useConnectSalesforce();
  const disconnect = useDisconnectSalesforceAction();
  const [instanceUrl, setInstanceUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityToken, setSecurityToken] = useState("");

  useEffect(() => {
    if (!connect.isSuccess) return;
    onDone();
  }, [connect.isSuccess, onDone]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        connect.mutate({
          instance_url: instanceUrl.trim(),
          username: username.trim(),
          password,
          security_token: securityToken.trim(),
        });
      }}
      className="space-y-4"
    >
      {info?.instructions && (
        <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {info.instructions}
        </pre>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="sf-url">Instance URL</Label>
          <Input
            id="sf-url"
            placeholder="https://databricks.my.salesforce.com"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="sf-user">Username</Label>
          <Input
            id="sf-user"
            placeholder="you@databricks.com"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sf-pwd">Password</Label>
          <Input
            id="sf-pwd"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sf-token">Security token</Label>
          <Input
            id="sf-token"
            type="password"
            value={securityToken}
            onChange={(e) => setSecurityToken(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
      </div>
      {connect.isError && (
        <p className="text-xs text-destructive">
          Couldn't save: {(connect.error as Error)?.message ?? "unknown error"}
        </p>
      )}
      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
        >
          {disconnect.isPending && (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          )}
          Disconnect
        </Button>
        <Button
          type="submit"
          disabled={connect.isPending}
        >
          {connect.isPending && (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          )}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
