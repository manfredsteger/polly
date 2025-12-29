import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Vote, Mail, Plus, Trash2, Save, Info } from "lucide-react";

interface SurveyOption {
  text: string;
  order: number;
}

interface SurveyFormProps {
  initialData?: {
    title: string;
    description: string;
    options: SurveyOption[];
  };
  onSubmit: (data: {
    title: string;
    description: string;
    creatorEmail?: string;
    userId?: number;
    options: SurveyOption[];
  }) => void;
  isLoading?: boolean;
  isAnonymous?: boolean;
}

export function SurveyForm({ 
  initialData, 
  onSubmit, 
  isLoading = false,
  isAnonymous = true 
}: SurveyFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [anonymousCreation, setAnonymousCreation] = useState(isAnonymous);
  const [options, setOptions] = useState<SurveyOption[]>(
    initialData?.options || [
      { text: "", order: 0 },
      { text: "", order: 1 },
    ]
  );

  const addOption = () => {
    setOptions([...options, { text: "", order: options.length }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, text: string) => {
    const updatedOptions = [...options];
    updatedOptions[index].text = text;
    setOptions(updatedOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validOptions = options.filter(opt => opt.text.trim());
    
    const formData = {
      title: title.trim(),
      description: description.trim(),
      creatorEmail: anonymousCreation ? creatorEmail.trim() : undefined,
      userId: anonymousCreation ? undefined : 1, // TODO: Get from auth context
      options: validOptions.map((option, index) => ({
        text: option.text.trim(),
        order: index,
      })),
    };

    onSubmit(formData);
  };

  const validOptions = options.filter(opt => opt.text.trim()).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Vote className="w-5 h-5 mr-2 text-polly-orange" />
            {t('pollForm.basicInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="title">{t('surveyForm.surveyTitle')} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('surveyForm.surveyTitlePlaceholder')}
              className="mt-1"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">{t('pollForm.descriptionOptional')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('surveyForm.surveyDescriptionPlaceholder')}
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Survey Options */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Vote className="w-5 h-5 mr-2 text-polly-blue" />
              {t('surveyForm.options')}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('surveyForm.addOption')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('surveyForm.addAtLeastTwo')}
            </p>
            
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                <Input
                  value={option.text}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={t('surveyForm.optionPlaceholder', { number: index + 1 })}
                  className="flex-1"
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-2">💡 {t('surveyForm.tip')}</h4>
                <p className="text-sm text-blue-800 mb-2">
                  {t('surveyForm.markdownTip')}
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <code className="bg-blue-100 px-1 rounded">[Text](URL)</code> {t('surveyForm.forLinks')}</li>
                  <li>• <code className="bg-blue-100 px-1 rounded">![Alt-Text](Bild-URL)</code> {t('surveyForm.forImages')}</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creation Options */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2 text-green-600" />
            {t('pollForm.creationOptions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="anonymous"
                checked={anonymousCreation}
                onCheckedChange={(checked) => setAnonymousCreation(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="anonymous" className="font-medium">
                  {t('pollForm.createAnonymously')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('pollForm.anonymousDescription')}
                </p>
                {anonymousCreation && (
                  <Input
                    type="email"
                    value={creatorEmail}
                    onChange={(e) => setCreatorEmail(e.target.value)}
                    placeholder={t('pollForm.emailPlaceholder')}
                    className="mt-3"
                    required
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          className="polly-button-primary"
          disabled={isLoading || !title.trim() || validOptions < 2}
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? t('pollForm.creating') : t('surveyForm.createSurvey')}
        </Button>
      </div>
    </form>
  );
}
