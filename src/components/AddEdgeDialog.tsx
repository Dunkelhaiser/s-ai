import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useState } from "react";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: number, directed: boolean) => void;
    edgeSource: string;
    edgeTarget: string;
}

const AddEdgeDialog = ({ isOpen, onClose, onAdd, edgeSource, edgeTarget }: Props) => {
    const [distance, setDistance] = useState("");
    const [directed, setDirected] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Connection</DialogTitle>
                    <DialogDescription>
                        Creating connection from {edgeSource} to {edgeTarget}
                    </DialogDescription>
                </DialogHeader>
                <Label>Distance (km):</Label>
                <Input value={distance} onChange={(e) => setDistance(e.target.value)} />
                <div className="flex items-center gap-4">
                    <Label>Directed:</Label>
                    <Input type="checkbox" checked={directed} onChange={(e) => setDirected(e.target.checked)} />
                </div>
                <div className="flex justify-end gap-x-4">
                    <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button
                        onClick={() => onAdd(parseInt(distance), directed)}
                        disabled={!distance.trim() || isNaN(parseInt(distance))}
                    >
                        Add
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
export default AddEdgeDialog;
