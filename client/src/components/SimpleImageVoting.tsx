import { useState, useEffect } from 'react';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Check, X, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type PollOption } from '@shared/schema';
import { formatScheduleOptionWithGermanWeekday } from '@/lib/utils';

function FormattedOptionText({ text, startTime }: { text: string; startTime?: Date | string | null }) {
  const startTimeStr = startTime instanceof Date ? startTime.toISOString() : startTime;
  const formatted = formatScheduleOptionWithGermanWeekday(text, startTimeStr);
  if (formatted.isSchedule) {
    return <><span className="font-bold">{formatted.dateWithWeekday}</span> {formatted.time}</>;
  }
  return <>{text}</>;
}

interface SimpleImageVotingProps {
  options: PollOption[];
  onVote: (optionId: string, response: 'yes' | 'no' | 'maybe') => void;
  existingVotes?: Record<string, 'yes' | 'no' | 'maybe'>;
  disabled?: boolean;
  adminPreview?: boolean;
  allowMaybe?: boolean;
}

export function SimpleImageVoting({ 
  options, 
  onVote, 
  existingVotes = {}, 
  disabled = false,
  adminPreview = false,
  allowMaybe = true
}: SimpleImageVotingProps) {
  const [votes, setVotes] = useState<Record<string, 'yes' | 'no' | 'maybe'>>(existingVotes);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Filter options that have images
  const imageOptions = options.filter(option => option.imageUrl && option.imageUrl.trim());
  const textOptions = options.filter(option => !option.imageUrl || !option.imageUrl.trim());
  const hasImages = imageOptions.length > 0;

  // Create slides for lightbox
  const slides = imageOptions.map(option => ({
    src: option.imageUrl || '',
    alt: option.altText || option.text,
    width: 1200,
    height: 900
  }));

  // Update votes when external votes change
  useEffect(() => {
    setVotes(existingVotes);
  }, [existingVotes]);

  const handleVoteClick = (optionId: string | number, response: 'yes' | 'no' | 'maybe') => {
    const id = String(optionId);
    setVotes(prev => ({ ...prev, [id]: response }));
    onVote(id, response);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Update lightbox when votes change
  useEffect(() => {
    // Force re-render of lightbox when votes change
    if (lightboxOpen) {
      // The lightbox will automatically re-render due to state change
    }
  }, [votes, lightboxOpen]);

  if (!hasImages && textOptions.length === 0) {
    return <div>No options available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Image grid with voting buttons */}
      {hasImages && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {imageOptions.map((option, index) => {
            const currentVote = votes[String(option.id)];
            return (
              <div key={option.id} className="space-y-3">
                <div 
                  className="block relative aspect-square overflow-hidden rounded-lg border hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => openLightbox(index)}
                >
                  <img 
                    src={option.imageUrl || ''} 
                    alt={option.altText || option.text}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                    <div className="text-white font-medium text-sm bg-black bg-opacity-50 px-3 py-1 rounded opacity-0 hover:opacity-100 transition-opacity">
                      Click to enlarge
                    </div>
                  </div>
                  {/* Vote indicator */}
                  {currentVote && (
                    <div className="absolute top-2 right-2">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        currentVote === 'yes' ? 'bg-green-600 text-white' :
                        currentVote === 'maybe' ? 'bg-yellow-500 text-black' :
                        'bg-red-600 text-white'
                      }`}>
                        {currentVote === 'yes' ? 'Ja' :
                         currentVote === 'maybe' ? 'Vielleicht' : 'Nein'}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Title and voting buttons below each image */}
                <div className="text-center">
                  <h4 className="font-medium text-lg mb-3"><FormattedOptionText text={option.text} startTime={option.startTime} /></h4>
                  {!adminPreview && (
                    <div className="flex gap-2">
                      <Button
                        className={`flex-1 py-2 ${currentVote === 'yes' ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-green-600 text-green-600 hover:bg-green-50'}`}
                        variant={currentVote === 'yes' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleVoteClick(option.id, 'yes')}
                        disabled={disabled}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Ja
                      </Button>
                      {allowMaybe && (
                        <Button
                          className={`flex-1 py-2 ${currentVote === 'maybe' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'border-yellow-500 text-yellow-600 hover:bg-yellow-50'}`}
                          variant={currentVote === 'maybe' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleVoteClick(option.id, 'maybe')}
                          disabled={disabled}
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          Vielleicht
                        </Button>
                      )}
                      <Button
                        className={`flex-1 py-2 ${currentVote === 'no' ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-red-600 text-red-600 hover:bg-red-50'}`}
                        variant={currentVote === 'no' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleVoteClick(option.id, 'no')}
                        disabled={disabled}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Nein
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Text-only options */}
      {textOptions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4">Text Optionen</h3>
          {textOptions.map((option) => {
            const currentVote = votes[String(option.id)];
            return (
              <div key={option.id} className="p-4 border rounded-lg">
                <h4 className="font-medium text-lg mb-3"><FormattedOptionText text={option.text} startTime={option.startTime} /></h4>
                {!adminPreview && (
                  <div className="flex gap-2">
                    <Button
                      className={`flex-1 py-2 ${currentVote === 'yes' ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-green-600 text-green-600 hover:bg-green-50'}`}
                      variant={currentVote === 'yes' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleVoteClick(option.id, 'yes')}
                      disabled={disabled}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Ja
                    </Button>
                    {allowMaybe && (
                      <Button
                        className={`flex-1 py-2 ${currentVote === 'maybe' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'border-yellow-500 text-yellow-600 hover:bg-yellow-50'}`}
                        variant={currentVote === 'maybe' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleVoteClick(option.id, 'maybe')}
                        disabled={disabled}
                      >
                        <Minus className="w-4 h-4 mr-1" />
                        Vielleicht
                      </Button>
                    )}
                    <Button
                      className={`flex-1 py-2 ${currentVote === 'no' ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-red-600 text-red-600 hover:bg-red-50'}`}
                      variant={currentVote === 'no' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleVoteClick(option.id, 'no')}
                      disabled={disabled}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Nein
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Yet Another React Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, .9)" },
        }}
        render={{
          buttonPrev: slides.length <= 1 ? () => null : undefined,
          buttonNext: slides.length <= 1 ? () => null : undefined,
          slide: ({ slide, offset, rect }) => {
            // Get the current slide index from the slide itself
            const currentSlideIndex = slides.findIndex(s => s.src === slide.src);
            const currentOption = imageOptions[currentSlideIndex >= 0 ? currentSlideIndex : lightboxIndex];
            const currentVote = votes[String(currentOption?.id)];
            
            return (
              <div className="yarl__slide_image_container" style={{ position: 'relative', width: '100%', height: '100%' }}>
                <img
                  src={slide.src}
                  alt={slide.alt}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
                
                {/* Title overlay at top */}
                {currentOption && (
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontWeight: '600',
                    maxWidth: '80%',
                    textAlign: 'center',
                    zIndex: 1000
                  }}>
                    {currentOption.text}
                  </div>
                )}
                
                {/* Voting buttons at bottom */}
                {currentOption && !adminPreview && (
                  <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    zIndex: 1000
                  }}>
                    <button
                      onClick={() => handleVoteClick(currentOption.id, 'yes')}
                      disabled={disabled}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '12px 16px',
                        border: `2px solid ${currentVote === 'yes' ? '#10b981' : 'rgba(255, 255, 255, 0.3)'}`,
                        borderRadius: '10px',
                        backgroundColor: currentVote === 'yes' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        minWidth: '70px',
                        minHeight: '70px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>✓</span>
                      <span>Ja</span>
                    </button>
                    
                    {allowMaybe && (
                      <button
                        onClick={() => handleVoteClick(currentOption.id, 'maybe')}
                        disabled={disabled}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '12px 16px',
                          border: `2px solid ${currentVote === 'maybe' ? '#f59e0b' : 'rgba(255, 255, 255, 0.3)'}`,
                          borderRadius: '10px',
                          backgroundColor: currentVote === 'maybe' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                          color: currentVote === 'maybe' ? 'black' : 'white',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          minWidth: '70px',
                          minHeight: '70px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>−</span>
                        <span>Vielleicht</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleVoteClick(currentOption.id, 'no')}
                      disabled={disabled}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '12px 16px',
                        border: `2px solid ${currentVote === 'no' ? '#ef4444' : 'rgba(255, 255, 255, 0.3)'}`,
                        borderRadius: '10px',
                        backgroundColor: currentVote === 'no' ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        minWidth: '70px',
                        minHeight: '70px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>✗</span>
                      <span>Nein</span>
                    </button>
                  </div>
                )}
              </div>
            );
          }
        }}
        on={{
          view: ({ index }) => {
            setLightboxIndex(index);
          },
        }}
      />
    </div>
  );
}