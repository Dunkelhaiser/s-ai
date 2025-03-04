import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useState } from "react";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => void;
}

const CreateNodeDialog = ({ isOpen, onClose, onCreate }: Props) => {
    const [name, setName] = useState("");

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New City</DialogTitle>
                </DialogHeader>
                <Label>City name:</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <div className="flex justify-end gap-x-4">
                    <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={() => onCreate(name)} disabled={!name.trim()}>
                        Add
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
export default CreateNodeDialog;
