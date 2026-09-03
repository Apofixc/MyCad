import React, { useState, useEffect, useRef } from "react";
import { X, Layers, FileText, Check, Plus } from "lucide-react";

export type ProjectFileType = "board" | "sch";

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (type: ProjectFileType, name: string) => void;
  existingFileNames: string[];
  suggestedName?: string;
}

export const NewFileDialog: React.FC<NewFileDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  existingFileNames,
  suggestedName,
}) => {
  const [fileType, setFileType] = useState<ProjectFileType>("board");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize and reset on open
  useEffect(() => {
    if (isOpen) {
      const defaultName =
        suggestedName ||
        (fileType === "board"
          ? `Board_${existingFileNames.filter((n) => n.endsWith(".board")).length + 1}`
          : `Schematic_${existingFileNames.filter((n) => n.endsWith(".sch")).length + 1}`);
      setFileName(defaultName);
      setError(null);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, fileType]);

  // Handle type switch update suggested name
  const handleSelectType = (type: ProjectFileType) => {
    setFileType(type);
    setError(null);
    const count =
      existingFileNames.filter((n) =>
        n.endsWith(type === "board" ? ".board" : ".sch")
      ).length + 1;
    setFileName(type === "board" ? `Board_${count}` : `Schematic_${count}`);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ext = fileType === "board" ? ".board" : ".sch";
    let trimmed = fileName.trim();

    if (!trimmed) {
      setError("Пожалуйста, введите название файла");
      return;
    }

    if (!trimmed.toLowerCase().endsWith(ext)) {
      trimmed = `${trimmed}${ext}`;
    }

    const isDuplicate = existingFileNames.some(
      (n) => n.toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      setError(`Файл с именем "${trimmed}" уже существует в проекте`);
      return;
    }

    onCreate(fileType, trimmed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const targetExt = fileType === "board" ? ".board" : ".sch";

  return (
    <div
      className="cad-modal-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="cad-dialog new-file-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cad-dialog-header">
          <div className="dialog-title-wrap">
            <Plus size={16} className="dialog-title-icon" />
            <h3>Добавить файл в проект</h3>
          </div>
          <button
            className="cad-dialog-close"
            onClick={onClose}
            title="Закрыть"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cad-dialog-body">
            {/* File Type Selection Cards */}
            <div className="cad-form-group">
              <label className="cad-label">Тип файла</label>
              <div className="file-type-selector">
                {/* Board Option */}
                <div
                  className={`file-type-card ${fileType === "board" ? "selected" : ""}`}
                  onClick={() => handleSelectType("board")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="file-type-card-header">
                    <div className="file-type-icon-box board-type-icon">
                      <Layers size={20} />
                    </div>
                    {fileType === "board" && (
                      <span className="file-type-checked">
                        <Check size={13} />
                      </span>
                    )}
                  </div>
                  <div className="file-type-info">
                    <div className="file-type-title">
                      <span>Печатная плата</span>
                      <span className="file-type-ext-badge board-badge">.board</span>
                    </div>
                    <div className="file-type-desc">
                      Монтажная плата, фотоподложка, трассировка и компоненты
                    </div>
                  </div>
                </div>

                {/* Schematic Option */}
                <div
                  className={`file-type-card ${fileType === "sch" ? "selected" : ""}`}
                  onClick={() => handleSelectType("sch")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="file-type-card-header">
                    <div className="file-type-icon-box sch-type-icon">
                      <FileText size={20} />
                    </div>
                    {fileType === "sch" && (
                      <span className="file-type-checked">
                        <Check size={13} />
                      </span>
                    )}
                  </div>
                  <div className="file-type-info">
                    <div className="file-type-title">
                      <span>Принципиальная схема</span>
                      <span className="file-type-ext-badge sch-badge">.sch</span>
                    </div>
                    <div className="file-type-desc">
                      Электрическая схема, связи и описания узлов
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* File Name Input */}
            <div className="cad-form-group">
              <label className="cad-label" htmlFor="new-file-name-input">
                Название файла <span className="cad-required">*</span>
              </label>
              <div className="cad-input-with-suffix">
                <input
                  id="new-file-name-input"
                  ref={inputRef}
                  type="text"
                  className={`cad-input ${error ? "has-error" : ""}`}
                  value={fileName}
                  onChange={(e) => {
                    setFileName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={fileType === "board" ? "Board_1" : "Schematic_1"}
                  autoFocus
                />
                <span className="cad-input-suffix">{targetExt}</span>
              </div>
              {error ? (
                <p className="cad-field-error">{error}</p>
              ) : (
                <p className="cad-field-hint">
                  Расширение <code>{targetExt}</code> будет добавлено автоматически
                </p>
              )}
            </div>
          </div>

          <div className="cad-dialog-footer">
            <button
              type="button"
              className="cad-btn-flat"
              onClick={onClose}
            >
              Отмена
            </button>
            <button type="submit" className="cad-btn-primary">
              Создать файл
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
