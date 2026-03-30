import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { provideServiceWorker } from '@angular/service-worker';

import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import {
  House, Bike, Package, Truck, List, User, Users, LayoutDashboard,
  CreditCard, Wallet, History, LogOut, Sun, Moon, Settings, Bell,
  Shield, Zap, Activity, Star, Phone, Mail, Clock, Route, MapPin,
  ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, ArrowRight, Check, X,
  TrendingUp, ChartBar,
  // Landing page additions
  CheckCircle, DollarSign, Smartphone, MessageSquare, BarChart2,
  Layers, Twitter, Facebook, Instagram, Navigation, Award,
  Globe, Wind, Building2, Lock, Heart,
  // Auth additions
  Eye, EyeOff, UserPlus, Send, UploadCloud, Image,
  // Additional icons
  FileText, Camera, Plus, CircleX,
  // Missing icons identified from components
  RotateCw, UserCog, FileSearch, ShieldOff, ShieldCheck, UserX, UserCheck,
  PieChart, Banknote, Gauge, ZoomIn, ImageOff, HelpCircle, ImagePlus,
  TriangleAlert, Info, Filter,
} from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor])
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        House, Bike, Package, Truck, List, User, Users, LayoutDashboard,
        CreditCard, Wallet, History, LogOut, Sun, Moon, Settings, Bell,
        Shield, Zap, Activity, Star, Phone, Mail, Clock, Route, MapPin,
        ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, ArrowRight, Check, X,
        TrendingUp, ChartBar,
        CheckCircle, DollarSign, Smartphone, MessageSquare, BarChart2,
        Layers, Twitter, Facebook, Instagram, Navigation, Award,
        Globe, Wind, Building2, Lock, Heart,
        Eye, EyeOff, UserPlus, Send, UploadCloud, Image,
        FileText, Camera, Plus, CircleX,
        RotateCw, UserCog, FileSearch, ShieldOff, ShieldCheck, UserX, UserCheck,
        PieChart, Banknote, Gauge, ZoomIn, ImageOff, HelpCircle, ImagePlus,
        TriangleAlert, Info, Filter,
      }),
    },
  ]
};
