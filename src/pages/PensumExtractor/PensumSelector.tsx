import UniversityContext from "contexts/university-data";
import { memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePreviousValue } from "beautiful-react-hooks";
import fileDialog from "file-dialog";

import { Button, Card, Container, Dropdown, DropdownButton, Form, InputGroup, Spinner } from "react-bootstrap";
import { FiSettings, FiDelete } from "react-icons/fi";
import { HiRefresh, HiUpload, HiDownload } from "react-icons/hi";
import { BsCodeSlash } from "react-icons/bs";
import { MdOutlineCreate } from "react-icons/md";

import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import selectTheme, { optionStyle } from "lib/DarkMode/select-theme";

import { sortByProp } from "lib/sort-utils";
import ActivePensumContext from "contexts/active-pensum";
import { useNavigate } from "react-router-dom";
import pensumToSavePensum from "functions/pensum-save";
import { download } from "lib/file-utils";
import { validatePensum } from "functions/pensum-converter";
import { groupBy } from "lodash";
import { japaneseDateFormat } from "lib/format-utils";


// type SelectProps = React.ComponentProps<typeof Select>['onChange'];
type SelectProps = { label: string, value: string } | null;

/** Creates a formatted label, for use with this component's <Select> labels. */
function createLabelString(code: string, name: string) {
  return `[${code}] ${name}`;
}


/** Simple form that manages University and Career selection 
 * (Populates the university/career list from the server.). */
function PensumSelector() {
  // Quite awful, just read this context from right to left.
  const { state: {
    pensum:   activePensum,
    error:    error_pensum,
    loading:  loading_pensum,
  },
    load:     loadPensum,
    dispatch: pensumDispatch,
  } = useContext(ActivePensumContext);

  const {
    state:  universityData,
    select: selectUniversity,
  } = useContext(UniversityContext);

  const {
    universities,
    selected: selected_uni,
    loading:  loading_uni,
    error:    error_uni,
  } = universityData;

  const [pensumOnInput, setPensumOnInput] = useState(null as SelectProps);
  const previousPensum = usePreviousValue(activePensum);
  const navigate = useNavigate();
  
  const [isDebug, setDebug] = useState(process.env.NODE_ENV || process.env.NODE_ENV === 'development');
  (function(){
    const w = window as any;
    if (!isDebug && !w.setDebug) {
      w.setDebug = setDebug;
      console.log('Call "setDebug(true)" to enable debug mode.');
    }
  })();

  // ***************************************************************************
  // Carrera select form <options>
  // Maps careers from {code, name} to {value, label}
  // ***************************************************************************
  const careerSelectOptions = useMemo(() => {
    const pensumList = selected_uni?.careers;
    if (!pensumList) return [];

    const o = pensumList.sort(sortByProp("code"));

    return o.map(x => ({ value: x.code, label: createLabelString(x.code, x.name) }));
  }, [selected_uni]);


  // ***************************************************************************
  // On pensum change
  //  If the pensum changed, do:
  //  1. Auto select university from the active pensum.
  //  2. Update the selected career <select> value.
  // ***************************************************************************
  useEffect(() => {
    // If pensums are the same, nothing to change!
    if (activePensum === previousPensum) return;
    // If no pensum is selected, there's nothing to "select"!
    if (!activePensum) return;

    // Select university
    selectUniversity(activePensum.institution);

    // Try to find existing label
    const careerOption = careerSelectOptions.find(x => x.value === activePensum.code)
      || {
      value: activePensum.code,
      label: createLabelString(activePensum.code, activePensum.career),
    };
    setPensumOnInput(careerOption);

  }, [activePensum, previousPensum, careerSelectOptions, selectUniversity]);


  // ***************************************************************************
  // University select
  // ***************************************************************************
  const universitySelectOptions = useMemo(() => universities.map(
    x => ({ value: x.code, label: createLabelString(x.shortName, x.longName) })),
    [universities]);

  const selectedUniversity = useMemo(() => (universitySelectOptions.find(
    x => x.value === selected_uni?.code) || null),
    [universitySelectOptions, selected_uni]);

  // On user change university selection
  const handleUniversityChange = useCallback((newValue: SelectProps) => {
    selectUniversity(newValue?.value || null);
  }, [selectUniversity]);


  // ***************************************************************************
  // On submit
  // ***************************************************************************
  const handleSubmit = useCallback((evt?: any) => {
    if (evt) evt.preventDefault();
    const uni = selected_uni?.code || '';
    const code = pensumOnInput?.value || '';
    loadPensum(uni, code);
  }, [loadPensum, selected_uni, pensumOnInput]);

  // ***************************************************************************
  // Submit btn content & state.
  // ***************************************************************************
  const submitBtnOpt = {
    disabled: false,
    content: 'Cargar' as React.ReactNode,
  }

  if (!pensumOnInput) {
    submitBtnOpt.disabled = true;
  }

  if (loading_pensum) {
    submitBtnOpt.content =
      <Spinner animation="border" size="sm">
        <span className="visually-hidden">Cargando...</span>
      </Spinner>
  }

  function savePensumToJson() {
    if (!activePensum) return;
    const saveData = pensumToSavePensum(activePensum);
    const json = JSON.stringify(saveData, null, 2);
    download(json, `${saveData.code} - ${saveData.career}.json`);
  }

  async function loadPensumFromJson() {
    const fileList = await fileDialog({ accept: 'text/json'});
    const file = fileList[0];
    const fileData = await file.text();
    const fileObject = JSON.parse(fileData);
    const newPensum = validatePensum(fileObject, '');
    if (newPensum) {
      pensumDispatch({type: 'set', payload: newPensum });
    } else {
      alert('Formato de pensum.json invalido!');
    }
  }
  
  function convertFileMakerXmlToPensum() {
    fileDialog({ accept: 'text/xml'})
    .then(files => files[0].text())
    .then(str => new DOMParser().parseFromString(str, 'text/xml'))
    .then(res => {
      // Step 1 - Extract data from XML
      const keys = Array.from(res.querySelectorAll('METADATA > FIELD')).map(x => x.getAttribute('NAME') as string);
      const rows = Array.from(res.querySelectorAll('RESULTSET > ROW')).map(row => {
        const rowObj: any = {}
        Array.from(row.querySelectorAll('COL')).forEach((col, idx) => {
          const data = Array.from(col.querySelectorAll('DATA')).map(d => d.textContent);
          if (data.length === 0) return;
          rowObj[keys[idx]] = (data.length === 1) ? data[0] : data;
        })
        return rowObj;
      })
      // Step 2 - Split rows by program and by semester
      const programMapRows = groupBy(rows, row => row['Clave programa']);
      const programMap: Record<string, Pensum.Pensum> = {}
      for (const [key, rows] of Object.entries(programMapRows)) {
        const career = rows[0]['Planes::Nombre programa'] as string;
        const pensum: Pensum.Pensum = {
          version: 5,
          career,
          code: key,
          fetchDate: japaneseDateFormat(new Date()),
          publishDate: japaneseDateFormat(new Date()),
          src: {
            type: 'convert',
            date: japaneseDateFormat(new Date()),
            url: null,
          },
          info: ['Master'],
          institution: 'uasd_master',
          loose: [],
          periodType: {
            acronym: 'Sem',
            name: 'Semestre',
            two: 'Sm',
          },
          periods: []
        }
        const matsByCuatRaw = groupBy(rows, row => row['Semestre Núm.']);
        const matsByCuatArr: any[][] = [];
        for (const [k, v] of Object.entries(matsByCuatRaw)) {
          const cuatNum = Number(k) - 1;
          if (!isNaN(cuatNum)) {
            matsByCuatArr[cuatNum] = v;
          } else {
            matsByCuatArr.push(v); // Tesis? etc...
          }
        }
        const periods = matsByCuatArr.map((rows) => rows.map((mat): Pensum.Mat => {
          const req: Pensum.Requirement[] = [];
          const reqVal = mat['Prerequisitos::clave prerequisito'];
          if (Array.isArray(reqVal)) {
            req.push(...reqVal);
          } else if (typeof reqVal === 'string') {
            req.push(reqVal);
          }
          return {
            code: mat['Clave asignatura'],
            cr: Number(mat['Nombre asignaturas::CR']),
            name: mat['Nombre asignaturas::Asignatura'],
            req,
          }
        }))
        pensum.periods = periods;
        programMap[key] = pensum;
      }

      // Step 3 - Output result
      for (const v of Object.values(programMap)) {
        const saveData = pensumToSavePensum(v);
        download(JSON.stringify(saveData, null, 2), `${saveData.code}.json`);
      }
    })
  }

  return (
    <Card>
      <Card.Body>
        <Container>
          {/* zIndex so that <Select> options are not covered by <MatFilter>. */}
          <Form onSubmit={handleSubmit} style={{ zIndex: 2, position: 'relative' }}>
            <SelectUni
              value={selectedUniversity}
              options={universitySelectOptions}
              isLoading={loading_uni}
              onChange={handleUniversityChange} 
              style={{display: 'none'}}
            />

            <SelectCareer
              value={pensumOnInput}
              options={careerSelectOptions}
              isLoading={loading_uni}
              onChange={setPensumOnInput} />

            <InputGroup className="w-100 d-flex">
              <Button
                type="submit"
                disabled={submitBtnOpt.disabled}
                className="flex-fill">
                {submitBtnOpt.content}
              </Button>
              <DropdownButton title={<FiSettings />}>
                <Dropdown.Item
                  disabled={!activePensum || !activePensum.src.url}>
                  <HiRefresh /> Forzar recarga
                </Dropdown.Item>
                <Dropdown.Item
                  disabled={!activePensum}
                  onClick={() => pensumDispatch({ type: 'clear' })}>
                  <FiDelete /> Remover pensum
                </Dropdown.Item>
                {isDebug && <>
                  <Dropdown.Divider />
                  <Dropdown.Item
                    onClick={loadPensumFromJson}
                  >
                    <HiUpload /> Cargar pensum.json
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={savePensumToJson}
                  >
                    <HiDownload /> Descargar pensum.json
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={convertFileMakerXmlToPensum}
                  >
                    <BsCodeSlash /> Convertir FileMaker.xml
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() => navigate('dev')}
                  >
                    <MdOutlineCreate /> Modo desarrollo
                  </Dropdown.Item>
                </>}
              </DropdownButton>
            </InputGroup>

            {error_uni && <p style={{ color: 'red' }}>{'Error @ uni: ' + String(error_uni)}</p>}
            {error_pensum && <p style={{ color: 'red' }}>{'Error @ pensum: ' + String(error_pensum)}</p>}
          </Form>
        </Container>
      </Card.Body>
    </Card>
  )
}


// ***************************************************************************
// University select
// ***************************************************************************
type CustomSelectProps = Omit<React.ComponentProps<'div'>, 'onChange'> & {
  value: SelectProps,
  options: SelectProps[],
  isLoading: boolean,
  onChange: Function,
}

const SelectUni = memo(
  function SelectUni({ value, options, isLoading, onChange, ...props }: CustomSelectProps) {
    return (<div {...props}>
      <label className="form-label mb-0 small">Universidad</label>
      <Select
        // defaultValue={universitySelectOptions[0]}
        value={value}
        options={options}
        isSearchable={true}
        isLoading={isLoading}
        onChange={onChange as any} // as any to be able to use selectStyles without TS panicking.
        name="university"
        className="mb-2"
        theme={selectTheme}

        placeholder="Seleccione una universidad..."
        styles={optionStyle} />
    </div>
    )
  }
);


// ***************************************************************************
// Career select
// ***************************************************************************
const SelectCareer = memo(
  function SelectCareer({ value, options, isLoading, onChange }: CustomSelectProps) {
    return (<>
      <label className="form-label mb-0 small">Programa</label>
      <CreatableSelect
        isClearable
        value={value}
        options={options}
        isLoading={isLoading}
        loadingMessage={() => <span>Cargando programas...</span>}
        onChange={onChange as any} // as any to be able to use selectStyles
        className="mb-2"
        theme={selectTheme}

        placeholder="Seleccione o escriba un programa o su codigo..."
        styles={optionStyle} />
    </>
    )
  }
);



export default PensumSelector;