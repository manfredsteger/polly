import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Upload, X } from 'lucide-react';

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
  onAltTextChange?: (altText: string) => void;
  currentImageUrl?: string;
  currentAltText?: string;
  className?: string;
}

export function ImageUpload({ onImageUploaded, onImageRemoved, onAltTextChange, currentImageUrl, currentAltText, className }: ImageUploadProps) {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('common.error'),
        description: t('imageUpload.selectImageFile'),
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('common.error'),
        description: t('imageUpload.fileTooLarge'),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/v1/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.virusName) {
          toast({
            title: t('imageUpload.virusDetected'),
            description: t('imageUpload.virusBlocked', { virusName: errorData.virusName }),
            variant: "destructive",
            duration: 8000,
          });
          return;
        }
        if (errorData.scannerUnavailable || response.status === 503) {
          toast({
            title: t('imageUpload.scannerUnavailable'),
            description: t('imageUpload.scannerUnavailableDescription'),
            variant: "destructive",
          });
          return;
        }
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onImageUploaded(data.imageUrl);
      
      toast({
        title: t('common.success'),
        description: t('imageUpload.uploadSuccess'),
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: t('common.error'),
        description: t('imageUpload.uploadError'),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    onImageRemoved();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {currentImageUrl ? (
        <div className="flex items-start space-x-4">
          {/* Image on the left */}
          <div className="relative flex-shrink-0">
            <img 
              src={currentImageUrl} 
              alt={currentAltText || "Uploaded"} 
              className="w-24 h-24 object-cover rounded-lg border shadow-md"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          
          {/* Alt Text field on the right */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('imageUpload.altTextLabel')}:
            </label>
            <textarea
              value={currentAltText || ''}
              onChange={(e) => onAltTextChange?.(e.target.value)}
              placeholder={t('imageUpload.altTextPlaceholder')}
              className="w-full h-20 p-2 text-sm border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('imageUpload.altTextHelp')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center space-x-1"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                <span>{t('common.loading')}</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>{t('imageUpload.image')}</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}