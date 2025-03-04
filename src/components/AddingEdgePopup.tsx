import { Button } from "./ui/button";

interface Props {
    isOpen: boolean;
    sourceNodeId: string | null;
    onCancel: () => void;
}

const AddingEdgePopup = ({ sourceNodeId, onCancel }: Props) => {
    return (
        <div className="fixed bottom-5 left-1/2 z-10 -translate-x-1/2 transform rounded-md border px-4 py-2 shadow-md">
            Connecting from {sourceNodeId}. Click another city to create connection or{" "}
            <Button variant="ghost" onClick={onCancel} size="sm">
                Cancel
            </Button>
        </div>
    );
};
export default AddingEdgePopup;
