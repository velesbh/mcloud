import { CreateServerWizard } from "@/components/server/CreateServerWizard";
import { PageHeader } from "@/components/shared/PageHeader";

export default function NewServerPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Create New Server"
        description="Set up your Minecraft server in a few clicks."
      />
      <CreateServerWizard />
    </div>
  );
}
