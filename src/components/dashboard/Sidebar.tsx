
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { HomeIcon, UsersIcon, StoreIcon, CoinsIcon, FileTextIcon, CheckIcon, ArrowRightLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { User, PuntoAtencion } from '../../types';

interface SidebarProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ user, selectedPoint, activeView, onViewChange, isOpen, onToggle }: SidebarProps) => {
  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: HomeIcon },
    { key: 'exchanges', label: 'Cambios de Divisas', icon: CoinsIcon },
    { key: 'transfers', label: 'Transferencias', icon: ArrowRightLeftIcon },
    { key: 'users', label: 'Usuarios', icon: UsersIcon, adminOnly: true },
    { key: 'points', label: 'Puntos de Atención', icon: StoreIcon, adminOnly: true },
    { key: 'currencies', label: 'Monedas', icon: CoinsIcon, adminOnly: true },
    { key: 'reports', label: 'Reportes', icon: FileTextIcon, adminOnly: true },
    { key: 'daily-close', label: 'Cierre Diario', icon: FileTextIcon },
    { key: 'transfer-approvals', label: 'Aprobar Transferencias', icon: CheckIcon, adminOnly: true }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.adminOnly && user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
      return false;
    }
    return true;
  });

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onToggle}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="lg:hidden">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-64">
          <SheetHeader className="space-y-2">
            <SheetTitle>Punto Cambio</SheetTitle>
            <SheetDescription>
              Navegación
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <div className="space-y-2">
              {filteredMenuItems.map(item => (
                <Button
                  key={item.key}
                  variant={activeView === item.key ? "secondary" : "ghost"}
                  onClick={() => onViewChange(item.key)}
                  className="w-full justify-start"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <aside className={`fixed left-0 top-0 z-20 h-full w-64 flex-col bg-white border-r overflow-y-auto transition-transform transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:border-r lg:flex`}>
        <div className="flex items-center justify-center h-16 border-b">
          <span className="text-lg font-semibold">Punto Cambio</span>
        </div>
        <div className="py-4 px-2">
          <div className="space-y-2">
            {filteredMenuItems.map(item => (
              <Button
                key={item.key}
                variant={activeView === item.key ? "secondary" : "ghost"}
                onClick={() => onViewChange(item.key)}
                className="w-full justify-start"
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
